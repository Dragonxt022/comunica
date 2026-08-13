// Cliente WhatsApp (Baileys) — um único número central da prefeitura/SECOM.
//
// IMPORTANTE: este módulo mantém um socket singleton em memória (`sock`). Isso só é seguro
// porque o PM2 roda este app com `instances: 1` (ver ecosystem.config.cjs). Se um dia mudar
// pra modo cluster/`instances: 'max'`, múltiplos processos vão brigar pela mesma sessão
// pareada e o WhatsApp vai tratar isso como conflito, derrubando a conexão repetidamente.
//
// Biblioteca não-oficial (protocolo do WhatsApp Web feito engenharia reversa) — risco de
// banimento do número aceito conscientemente. Versão fixada em 6.7.24 (tag `legacy`, estável,
// 100% JS/TS sem dependência nativa).

import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import pino from 'pino';
import { Op } from 'sequelize';
import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from '@whiskeysockets/baileys';
import type { WASocket } from '@whiskeysockets/baileys';
import { User, Configuracao, Evento, Solicitacao } from '../database/models/index.ts';
import { sseBroker } from './sse.ts';
import { bustConfigCache } from './config-cache.ts';
import { secretariaWhere } from './municipio-filter.ts';

export interface WhatsappPayload {
  titulo: string;
  corpo?: string;
  url?: string;
  tipo?: string;
}

const AUTH_DIR = path.join(process.cwd(), 'data', 'whatsapp-auth');

let sock: WASocket | null = null;
let currentQr: string | null = null;
let connecting = false;

// A dependência `libsignal` (usada pelo Baileys por baixo dos panos) chama console.log
// diretamente pra logar o fechamento de sessões — bypassa completamente o logger `pino` que
// passamos pro Baileys, e despeja chaves criptográficas de sessão em texto puro no log. Como
// isso é feito com console.log('Closing session:', ...) hardcoded na própria lib, o único jeito
// de conter é filtrar essa chamada específica aqui, sem mexer em nenhum outro console.log da app.
const __originalConsoleLog = console.log.bind(console);
console.log = (...args: any[]) => {
  if (typeof args[0] === 'string' && args[0].startsWith('Closing session')) return;
  __originalConsoleLog(...args);
};

// ── Normalização de número ──────────────────────────────────────────────────

/** Remove tudo que não é dígito, garante DDI 55, valida comprimento (DDI+DDD+número). */
export function normalizeNumero(input: string): string | null {
  let digitos = String(input || '').replace(/\D/g, '');
  if (!digitos) return null;
  if (!digitos.startsWith('55')) digitos = '55' + digitos;
  // 55 + DDD (2) + número (8 ou 9 dígitos) = 12 ou 13 dígitos
  if (digitos.length < 12 || digitos.length > 13) return null;
  return digitos;
}

function numeroToJid(numero: string): string {
  return `${numero}@s.whatsapp.net`;
}

/** Evita que uma chamada ao Baileys (rede instável, WhatsApp sem responder) trave a requisição pra sempre. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout (${ms}ms) em: ${label}`)), ms)),
  ]);
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getWhatsappStatus(): { conectado: boolean; qr: string | null; conectando: boolean; numero: string | null } {
  const numero = sock?.user?.id?.split(':')[0]?.split('@')[0] || null;
  return { conectado: !!sock?.user, qr: currentQr, conectando: connecting, numero };
}

async function broadcastToSuperAdmins(eventName: string, data: Record<string, any>): Promise<void> {
  try {
    const admins = await User.findAll({ where: { role: 'super_admin', ativo: true }, attributes: ['id'] });
    for (const a of admins) sseBroker.sendToUser(a.id, eventName, data);
  } catch { /* silencioso */ }
}

// ── Inicialização ────────────────────────────────────────────────────────────

/**
 * @param force Se `false` (padrão, usado no boot do servidor), só conecta se já existir uma
 * sessão pareada — não sobe um socket "girando QR" sozinho sem ninguém olhando. O botão
 * "Conectar" da tela admin passa `force: true`, e nesse caso qualquer sessão salva em disco
 * (completa ou parcial) é descartada antes de começar, pra garantir um QR novo de verdade em vez
 * de tentar retomar uma sessão antiga — que o WhatsApp pode rejeitar com "não foi possível
 * conectar" no celular se já não for mais válida do lado do servidor deles. Reconexão automática
 * de sessão ainda válida (ex.: depois de uma queda de rede) é tratada à parte, pelo retry do
 * handler de `connection.update`, sem precisar do botão.
 */
export async function startWhatsapp(force = false): Promise<void> {
  if (connecting || sock?.user) return;

  if (force) {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  if (!force && !state.creds.registered) return;

  connecting = true;
  // Trava de segurança: se `connection.update` nunca disparar open/close por algum motivo,
  // isso evita que "connecting" fique travado em true pra sempre e bloqueie novas tentativas.
  setTimeout(() => { connecting = false; }, 60_000);

  try {
    const { version } = await fetchLatestBaileysVersion();

    const logger = pino({ level: process.env.WHATSAPP_LOG_LEVEL || 'silent' }) as any;
    sock = makeWASocket({ version, auth: state, logger, printQRInTerminal: false } as any);

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (update) => handleConnectionUpdate(update).catch((e) => console.error('WhatsApp connection.update error:', e)));
    sock.ev.on('messages.upsert', (payload) => handleIncomingMessages(payload).catch((e) => console.error('WhatsApp messages.upsert error:', e)));
  } catch (err) {
    console.error('Erro ao iniciar WhatsApp:', err);
    connecting = false;
  }
}

async function handleConnectionUpdate(update: Partial<{ connection: string; lastDisconnect: any; qr: string }>): Promise<void> {
  const { connection, lastDisconnect, qr } = update;

  if (qr) {
    currentQr = await QRCode.toDataURL(qr);
    await broadcastToSuperAdmins('whatsapp:qr', { qr: currentQr });
  }

  if (connection === 'open') {
    connecting = false;
    currentQr = null;
    const numero = sock?.user?.id?.split(':')[0]?.split('@')[0] || null;
    await Configuracao.update({ whatsapp_conectado: true, whatsapp_numero_conectado: numero } as any, { where: { id: 1 } });
    bustConfigCache();
    await broadcastToSuperAdmins('whatsapp:status', { conectado: true, numero });
  }

  if (connection === 'close') {
    connecting = false;
    const statusCode = lastDisconnect?.error?.output?.statusCode;

    if (statusCode === DisconnectReason.loggedOut) {
      // Desvinculado do celular (ou banido) — exige nova ação manual, não reconecta sozinho.
      sock = null;
      currentQr = null;
      await Configuracao.update({ whatsapp_conectado: false, whatsapp_numero_conectado: null } as any, { where: { id: 1 } });
      bustConfigCache();
      await broadcastToSuperAdmins('whatsapp:status', { conectado: false, numero: null });
      return;
    }

    // `restartRequired` é esperado logo após um pareamento bem-sucedido — reconectar
    // automaticamente é o comportamento normal, não um erro.
    await Configuracao.update({ whatsapp_conectado: false } as any, { where: { id: 1 } });
    bustConfigCache();
    await broadcastToSuperAdmins('whatsapp:status', { conectado: false, numero: null, reconectando: true });
    sock = null;
    setTimeout(() => { startWhatsapp().catch((e) => console.error('Erro ao reconectar WhatsApp:', e)); }, 5_000);
  }
}

export async function disconnectWhatsapp(): Promise<void> {
  try {
    await sock?.logout();
  } catch { /* já pode estar desconectado */ }
  sock = null;
  currentQr = null;
  connecting = false;
  try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch { /* silencioso */ }
  await Configuracao.update({ whatsapp_conectado: false, whatsapp_numero_conectado: null } as any, { where: { id: 1 } });
  bustConfigCache();
  await broadcastToSuperAdmins('whatsapp:status', { conectado: false, numero: null });
}

// ── Envio de notificações (chamado por notificar()) ─────────────────────────

export async function sendWhatsapp(userId: number, payload: WhatsappPayload): Promise<void> {
  if (!sock?.user) return;
  const user = await User.findByPk(userId);
  if (!user || !(user as any).whatsapp_notificacoes_ativo || !(user as any).whatsapp_numero) return;

  const texto = montarTextoNotificacao(payload);
  try {
    await withTimeout(sock.sendMessage(numeroToJid((user as any).whatsapp_numero), { text: texto }), 15_000, 'sendMessage (notificação)');
  } catch (err) {
    console.error('Erro/timeout ao enviar WhatsApp:', err);
  }
}

function montarTextoNotificacao(payload: WhatsappPayload): string {
  let texto = `*${payload.titulo}*`;
  if (payload.corpo) texto += `\n${payload.corpo}`;
  if (payload.url) {
    const base = (process.env.APP_URL || '').replace(/\/$/, '');
    texto += `\n${base}${payload.url}`;
  }
  return texto;
}

// ── Verificação de número (OTP) ──────────────────────────────────────────────

export async function enviarCodigoVerificacao(userId: number, numeroBruto: string): Promise<{ ok: boolean; error?: string }> {
  const numero = normalizeNumero(numeroBruto);
  if (!numero) return { ok: false, error: 'Número de WhatsApp inválido.' };
  if (!sock?.user) return { ok: false, error: 'O WhatsApp da prefeitura ainda não está conectado. Tente novamente mais tarde.' };

  // JID que vamos realmente usar para enviar. Começa com o que construímos a partir do número
  // digitado, mas é substituído pelo JID *canônico* que o próprio WhatsApp devolver abaixo —
  // números de celular brasileiro têm a ambiguidade do 9º dígito (com/sem), e mandar pro JID
  // que a gente monta na mão pode simplesmente não entregar em silêncio.
  let jidDestino = numeroToJid(numero);

  try {
    const check = await withTimeout(sock.onWhatsApp(jidDestino), 15_000, 'onWhatsApp');
    const match = check?.find((c) => c.exists);
    if (!match) {
      return { ok: false, error: 'Esse número não foi encontrado no WhatsApp. Confira e tente de novo.' };
    }
    if (match.jid) jidDestino = match.jid;
  } catch (err) {
    console.error('WhatsApp onWhatsApp() falhou/expirou:', err);
    // Instabilidade momentânea — não bloquear o envio por causa disso, segue com o JID construído.
  }

  const codigo = String(Math.floor(100000 + Math.random() * 900000));
  const agora = new Date();
  const expira = new Date(agora.getTime() + 10 * 60 * 1000);

  // Persiste o número derivado do JID canônico (não o digitado) — é para esse número que as
  // notificações futuras serão enviadas, e é o número que vai bater com o remetente quando ele
  // mandar "hoje" pelo WhatsApp. Guardar o número "cru" aqui reintroduziria a mesma ambiguidade
  // do 9º dígito que o lookup acima existe pra resolver.
  const numeroCanonico = jidDestino.split('@')[0];

  await User.update({
    whatsapp_numero_pendente: numeroCanonico,
    whatsapp_codigo_verificacao: codigo,
    whatsapp_codigo_enviado_em: agora,
    whatsapp_codigo_expira_em: expira,
  } as any, { where: { id: userId } });

  try {
    await withTimeout(
      sock.sendMessage(jidDestino, { text: `Seu código de verificação do Comunica é: *${codigo}*\n\nVálido por 10 minutos.` }),
      15_000,
      'sendMessage (código de verificação)',
    );
  } catch (err) {
    console.error('Erro/timeout ao enviar código de verificação:', err);
    return { ok: false, error: 'Não foi possível enviar o código. Tente novamente.' };
  }

  return { ok: true };
}

export async function confirmarCodigoVerificacao(userId: number, codigo: string): Promise<{ ok: boolean; error?: string }> {
  const user = await User.findByPk(userId);
  if (!user) return { ok: false, error: 'Usuário não encontrado.' };

  const u = user as any;
  if (!u.whatsapp_codigo_verificacao || !u.whatsapp_numero_pendente) {
    return { ok: false, error: 'Nenhum código pendente. Solicite um novo código.' };
  }
  if (!u.whatsapp_codigo_expira_em || new Date(u.whatsapp_codigo_expira_em) < new Date()) {
    return { ok: false, error: 'Código expirado. Solicite um novo código.' };
  }
  if (String(codigo).trim() !== u.whatsapp_codigo_verificacao) {
    return { ok: false, error: 'Código incorreto.' };
  }

  const numeroConfirmado = u.whatsapp_numero_pendente;
  await user.update({
    whatsapp_numero: numeroConfirmado,
    whatsapp_notificacoes_ativo: true,
    whatsapp_numero_pendente: null,
    whatsapp_codigo_verificacao: null,
    whatsapp_codigo_enviado_em: null,
    whatsapp_codigo_expira_em: null,
  } as any);

  sendWhatsapp(userId, {
    titulo: 'WhatsApp conectado! ✅',
    corpo: 'Você vai receber por aqui o status dos seus chamados e lembretes de tarefas. Envie *hoje* a qualquer momento para ver o que tem pra hoje.',
  }).catch(() => {});

  return { ok: true };
}

// ── Comando "hoje" (mensagens recebidas) ─────────────────────────────────────

async function handleIncomingMessages(payload: { messages: any[]; type: string }): Promise<void> {
  if (payload.type !== 'notify' || !sock) return;

  for (const msg of payload.messages) {
    try {
      if (msg.key?.fromMe) {
        // Mensagem enviada pela própria conta conectada (inclusive "Mensagem pra você mesmo").
        // Ignorada de propósito: se o número central algum dia responder às próprias mensagens
        // sem esse filtro, cria um loop de resposta infinita.
        continue;
      }
      const remoteJid: string | undefined = msg.key?.remoteJid;
      if (!remoteJid || remoteJid.endsWith('@g.us')) continue;

      const numeroBruto = remoteJid.split('@')[0];
      const numero = normalizeNumero(numeroBruto);
      if (!numero) continue;

      const texto: string = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim().toLowerCase();
      if (!texto) continue;

      console.log(`WhatsApp: mensagem recebida de ${numero}: "${texto}"`);

      const user = await User.findOne({ where: { whatsapp_numero: numero, whatsapp_notificacoes_ativo: true, ativo: true } });
      if (!user) {
        await withTimeout(
          sock.sendMessage(remoteJid, { text: 'Não encontrei seu número cadastrado no Comunica. Ative as notificações em Perfil > WhatsApp no sistema.' }),
          15_000, 'sendMessage (não cadastrado)',
        );
        continue;
      }

      if (texto === 'hoje' || texto.startsWith('hoje')) {
        const resposta = await montarRespostaHoje(user);
        await withTimeout(sock.sendMessage(remoteJid, { text: resposta }), 15_000, 'sendMessage (hoje)');
      } else {
        await withTimeout(
          sock.sendMessage(remoteJid, { text: 'Não entendi. Envie *hoje* para ver os seus trabalhos de hoje.' }),
          15_000, 'sendMessage (não entendi)',
        );
      }
    } catch (err) {
      console.error('Erro/timeout processando mensagem do WhatsApp:', err);
    }
  }
}

async function montarRespostaHoje(user: any): Promise<string> {
  const inicioDoDia = new Date(); inicioDoDia.setHours(0, 0, 0, 0);
  const fimDoDia = new Date(); fimDoDia.setHours(23, 59, 59, 999);
  const hojeStr = inicioDoDia.toISOString().slice(0, 10);

  const [eventos, solicitacoes] = await Promise.all([
    Evento.findAll({
      where: secretariaWhere(user, { data_inicio: { [Op.between]: [inicioDoDia, fimDoDia] }, arquivado: false }),
      order: [['data_inicio', 'ASC']],
    }),
    Solicitacao.findAll({
      where: secretariaWhere(user, { prazo: hojeStr, status: { [Op.ne]: 'cancelado' } }),
    }),
  ]);

  if (eventos.length === 0 && solicitacoes.length === 0) {
    return 'Nada agendado pra hoje 🎉';
  }

  let texto = `*Seus trabalhos de hoje:*\n`;

  if (eventos.length > 0) {
    texto += `\n📅 *Eventos*\n`;
    for (const e of eventos as any[]) {
      const hora = new Date(e.data_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      texto += `• ${hora} — ${e.titulo}${e.local ? ` (${e.local})` : ''}\n`;
    }
  }

  if (solicitacoes.length > 0) {
    texto += `\n📋 *Solicitações com prazo hoje*\n`;
    for (const s of solicitacoes as any[]) {
      texto += `• ${s.titulo} — ${s.status}\n`;
    }
  }

  return texto.trim();
}
