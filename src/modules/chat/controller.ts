import { Request, Response } from 'express';
import { Op, literal } from 'sequelize';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { ChatConversa, ChatMensagem, ChatParticipante, ChatUserKey, User, Secretaria } from '../../database/models/index.ts';
import { sseBroker } from '../../lib/sse.ts';

const user = (req: any) => req.session.user as { id: number; role: string; municipio_id: number; secretaria_id?: number; nome: string; avatar?: string };

// ── helpers ──────────────────────────────────────────────────────────────────

async function participaConversa(conversaId: number, userId: number): Promise<boolean> {
  const p = await ChatParticipante.findOne({ where: { conversa_id: conversaId, user_id: userId, ativo: true } });
  return !!p;
}

async function broadcastMensagem(conversa_id: number, payload: Record<string, any>) {
  const participantes = await ChatParticipante.findAll({ where: { conversa_id, ativo: true } });
  for (const p of participantes as any[]) {
    sseBroker.sendToUser(p.user_id, 'chat:mensagem', payload);
  }
}

// ── Listar conversas ──────────────────────────────────────────────────────────

export const listarConversas = async (req: Request, res: Response) => {
  try {
    const me = user(req);

    // Step 1: find all active participations for this user
    const minhasParts = await ChatParticipante.findAll({
      where: { user_id: me.id, ativo: true },
      attributes: ['id','conversa_id','user_id','ultimo_lido_at'],
    }) as any[];

    if (!minhasParts.length) return res.json({ conversas: [] });

    const conversaIds = minhasParts.map((p: any) => p.conversa_id);

    // Step 2: get conversas ordered by updatedAt
    const conversas = await ChatConversa.findAll({
      where: { id: { [Op.in]: conversaIds } },
      order: [['updatedAt', 'DESC']],
    }) as any[];

    // Step 3: get all participants + their users for these conversas
    const todosParticipantes = await ChatParticipante.findAll({
      where: { conversa_id: { [Op.in]: conversaIds }, ativo: true },
      include: [{ model: User, as: 'usuario', attributes: ['id','nome','avatar','role'] }],
    }) as any[];

    const result = [];
    for (const conv of conversas) {
      const minhaPart = minhasParts.find((p: any) => p.conversa_id === conv.id);
      if (!minhaPart) continue;

      const participantesConv = todosParticipantes.filter((p: any) => p.conversa_id === conv.id);

      // Count unread
      const ultimoLido = minhaPart.ultimo_lido_at ? new Date(minhaPart.ultimo_lido_at) : new Date(0);
      const nao_lidas = await ChatMensagem.count({
        where: {
          conversa_id: conv.id,
          excluido: false,
          user_id: { [Op.ne]: me.id },
          createdAt: { [Op.gt]: ultimoLido },
        },
      });

      // Last message (simple separate query — no nested limit)
      const ultima_msg_rec = await ChatMensagem.findOne({
        where: { conversa_id: conv.id, excluido: false },
        order: [['createdAt', 'DESC']],
        attributes: ['id','tipo','conteudo_enc','iv_hex','arquivo_mime','createdAt','user_id'],
      });

      let outro_usuario = null;
      if ((conv as any).tipo === 'dm') {
        const outro = participantesConv.find((p: any) => p.user_id !== me.id);
        outro_usuario = outro?.usuario || null;
      }

      result.push({
        id: conv.id,
        tipo: (conv as any).tipo,
        nome: (conv as any).tipo === 'dm' ? (outro_usuario?.nome || 'Usuário') : ((conv as any).nome || 'Grupo'),
        avatar: (conv as any).tipo === 'dm' ? outro_usuario?.avatar : null,
        outro_user_id: (conv as any).tipo === 'dm' ? outro_usuario?.id : null,
        participantes: participantesConv.map((p: any) => ({
          id: p.user_id, nome: p.usuario?.nome, avatar: p.usuario?.avatar,
          lido_at: p.ultimo_lido_at ? new Date(p.ultimo_lido_at).toISOString() : null,
        })),
        nao_lidas,
        ultima_msg: ultima_msg_rec ? (ultima_msg_rec as any).toJSON() : null,
        updatedAt: (conv as any).updatedAt,
      });
    }

    res.json({ conversas: result });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erro interno' }); }
};

// ── Criar / abrir DM ──────────────────────────────────────────────────────────

export const abrirDM = async (req: Request, res: Response) => {
  try {
    const me = user(req);
    const outroId = Number(req.body.user_id);
    if (!outroId || outroId === me.id) return res.status(400).json({ error: 'user_id inválido' });

    // Check if DM already exists between these two users
    const existente = await ChatParticipante.findOne({
      where: { user_id: me.id },
      include: [{
        model: ChatConversa, as: 'conversa',
        where: { tipo: 'dm' },
        include: [{ model: ChatParticipante, as: 'participantes', where: { user_id: outroId } }],
      }],
    }) as any;

    if (existente) {
      return res.json({ conversa_id: existente.conversa_id });
    }

    // Create new DM
    const conv = await ChatConversa.create({ tipo: 'dm', criado_por: me.id, municipio_id: me.municipio_id });
    await ChatParticipante.bulkCreate([
      { conversa_id: conv.id, user_id: me.id },
      { conversa_id: conv.id, user_id: outroId },
    ]);

    // Notify the other user via SSE
    sseBroker.sendToUser(outroId, 'chat:nova_conversa', { conversa_id: conv.id });

    res.json({ conversa_id: conv.id });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erro interno' }); }
};

// ── Criar grupo ───────────────────────────────────────────────────────────────

export const criarGrupo = async (req: Request, res: Response) => {
  try {
    const me = user(req);
    const { nome, participantes } = req.body as { nome: string; participantes: number[] };
    if (!nome?.trim()) return res.status(400).json({ error: 'Nome obrigatório' });

    const ids: number[] = Array.isArray(participantes) ? participantes.map(Number) : [];
    if (!ids.includes(me.id)) ids.push(me.id);

    const conv = await ChatConversa.create({ tipo: 'grupo', nome: nome.trim(), criado_por: me.id, municipio_id: me.municipio_id });
    await ChatParticipante.bulkCreate(ids.map(uid => ({ conversa_id: conv.id, user_id: uid })));

    for (const uid of ids) {
      if (uid !== me.id) sseBroker.sendToUser(uid, 'chat:nova_conversa', { conversa_id: conv.id });
    }

    res.json({ conversa_id: conv.id });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erro interno' }); }
};

// ── Buscar mensagens ──────────────────────────────────────────────────────────

export const buscarMensagens = async (req: Request, res: Response) => {
  try {
    const me = user(req);
    const conversaId = Number(req.params.id);
    if (!await participaConversa(conversaId, me.id)) return res.status(403).json({ error: 'Acesso negado' });

    const cursor = req.query.cursor ? new Date(String(req.query.cursor)) : null;
    const whereExtra = cursor ? { createdAt: { [Op.lt]: cursor } } : {};

    const msgs = await ChatMensagem.findAll({
      where: { conversa_id: conversaId, excluido: false, ...whereExtra },
      include: [{ model: User, as: 'remetente', attributes: ['id','nome','avatar','role'] }],
      order: [['createdAt', 'DESC']],
      limit: 50,
    }) as any[];

    const conversa = await ChatConversa.findByPk(conversaId);

    res.json({
      mensagens: msgs.reverse(),
      tipo: (conversa as any)?.tipo,
      hasMore: msgs.length === 50,
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erro interno' }); }
};

// ── Enviar mensagem ───────────────────────────────────────────────────────────

export const enviarMensagem = async (req: Request, res: Response) => {
  try {
    const me = user(req);
    const conversaId = Number(req.params.id);
    if (!await participaConversa(conversaId, me.id)) return res.status(403).json({ error: 'Acesso negado' });

    const { tipo = 'texto', conteudo_enc, iv_hex, arquivo_url, arquivo_nome, arquivo_tamanho, arquivo_mime } = req.body;

    const msg = await ChatMensagem.create({
      conversa_id: conversaId,
      user_id: me.id,
      tipo,
      conteudo_enc: conteudo_enc || null,
      iv_hex: iv_hex || null,
      arquivo_url: arquivo_url || null,
      arquivo_nome: arquivo_nome || null,
      arquivo_tamanho: arquivo_tamanho ? Number(arquivo_tamanho) : null,
      arquivo_mime: arquivo_mime || null,
    }) as any;

    // Bump conversa updatedAt
    await ChatConversa.update({ updatedAt: new Date() } as any, { where: { id: conversaId } });

    const payload = {
      id: msg.id,
      conversa_id: conversaId,
      user_id: me.id,
      remetente: { id: me.id, nome: me.nome, avatar: me.avatar || null },
      tipo,
      conteudo_enc: conteudo_enc || null,
      iv_hex: iv_hex || null,
      arquivo_url: arquivo_url || null,
      arquivo_nome: arquivo_nome || null,
      arquivo_tamanho: arquivo_tamanho || null,
      arquivo_mime: arquivo_mime || null,
      createdAt: msg.createdAt,
    };

    await broadcastMensagem(conversaId, payload);

    res.json({ ok: true, mensagem: payload });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erro interno' }); }
};

// ── Marcar como lida — broadcasts "chat:lida" so sender updates checkmarks ───

export const marcarLida = async (req: Request, res: Response) => {
  try {
    const me = user(req);
    const conversaId = Number(req.params.id);
    const now = new Date();
    await ChatParticipante.update(
      { ultimo_lido_at: now },
      { where: { conversa_id: conversaId, user_id: me.id } },
    );
    // Notify the other participants so their checkmarks turn blue
    const parts = await ChatParticipante.findAll({ where: { conversa_id: conversaId, ativo: true } }) as any[];
    for (const p of parts) {
      if (p.user_id !== me.id) {
        sseBroker.sendToUser(p.user_id, 'chat:lida', {
          conversa_id: conversaId,
          user_id: me.id,
          lido_at: now.toISOString(),
        });
      }
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Erro interno' }); }
};

// ── Typing indicator ─────────────────────────────────────────────────────────

export const notificarDigitando = async (req: Request, res: Response) => {
  try {
    const me = user(req);
    const conversaId = Number(req.params.id);
    const parts = await ChatParticipante.findAll({ where: { conversa_id: conversaId, ativo: true } }) as any[];
    for (const p of parts) {
      if (p.user_id !== me.id) {
        sseBroker.sendToUser(p.user_id, 'chat:digitando', {
          conversa_id: conversaId,
          user_id: me.id,
          nome: me.nome,
        });
      }
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false }); }
};

// ── Upload de arquivo (imagem / áudio) ────────────────────────────────────────

export const uploadArquivo = async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Arquivo não enviado' });

    const { originalname, mimetype, size, filename } = req.file;
    const url = `/uploads/chat/${filename}`;

    res.json({ url, nome: originalname, tamanho: size, mime: mimetype });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erro interno' }); }
};

// ── Chaves ECDH ──────────────────────────────────────────────────────────────

export const getKey = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.userId);
    const key = await ChatUserKey.findOne({ where: { user_id: userId } });
    if (!key) return res.status(404).json({ error: 'Chave não encontrada' });
    res.json({ public_key_jwk: (key as any).public_key_jwk });
  } catch (e) { res.status(500).json({ error: 'Erro interno' }); }
};

export const salvarKey = async (req: Request, res: Response) => {
  try {
    const me = user(req);
    const { public_key_jwk } = req.body;
    if (!public_key_jwk) return res.status(400).json({ error: 'public_key_jwk obrigatório' });

    await ChatUserKey.upsert({ user_id: me.id, public_key_jwk });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Erro interno' }); }
};

// ── Usuários disponíveis para chat ────────────────────────────────────────────

export const listarUsuarios = async (req: Request, res: Response) => {
  try {
    const me = user(req);
    const where: any = { id: { [Op.ne]: me.id } };

    // admin/secom/super_admin see all users in municipality; others see same secretaria only
    if (me.role === 'super_admin') {
      // no extra filter — see everyone
    } else if (['admin', 'secom'].includes(me.role)) {
      where.municipio_id = me.municipio_id;
    } else if (me.secretaria_id) {
      where.secretaria_id = me.secretaria_id;
    } else {
      where.municipio_id = me.municipio_id;
    }

    const usuarios = await User.findAll({
      where,
      attributes: ['id', 'nome', 'role', 'secretaria_id', 'avatar'],
      include: [{ model: Secretaria, as: 'secretaria', attributes: ['id', 'nome', 'cor'], required: false }],
      order: [['nome', 'ASC']],
    }) as any[];

    res.json({ usuarios });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erro interno' }); }
};

// ── Total de não lidas ────────────────────────────────────────────────────────

export const totalNaoLidas = async (req: Request, res: Response) => {
  try {
    const me = user(req);

    const participacoes = await ChatParticipante.findAll({ where: { user_id: me.id, ativo: true } }) as any[];
    let total = 0;
    for (const p of participacoes) {
      const desde = p.ultimo_lido_at ? new Date(p.ultimo_lido_at) : new Date(0);
      const count = await ChatMensagem.count({
        where: { conversa_id: p.conversa_id, excluido: false, user_id: { [Op.ne]: me.id }, createdAt: { [Op.gt]: desde } },
      });
      total += count;
    }
    res.json({ total });
  } catch (e) { res.status(500).json({ error: 'Erro interno' }); }
};

// ── Excluir mensagem (para mim) ───────────────────────────────────────────────

export const excluirMensagem = async (req: Request, res: Response) => {
  try {
    const me = user(req);
    const msgId = Number(req.params.msgId);
    const msg = await ChatMensagem.findOne({ where: { id: msgId, user_id: me.id } }) as any;
    if (!msg) return res.status(404).json({ error: 'Mensagem não encontrada' });

    // Remove physical file if media
    if (msg.arquivo_url) {
      const abs = path.join(process.cwd(), 'public', msg.arquivo_url);
      fs.unlink(abs, () => {});
    }
    await msg.update({ excluido: true, conteudo_enc: null, arquivo_url: null });

    await broadcastMensagem(msg.conversa_id, { type: 'excluida', id: msgId, conversa_id: msg.conversa_id });

    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Erro interno' }); }
};

// ── Info de armazenamento do chat (para admin) ────────────────────────────────

export const storageInfo = async (req: Request, res: Response) => {
  try {
    const chatDir = path.join(process.cwd(), 'public', 'uploads', 'chat');
    if (!fs.existsSync(chatDir)) return res.json({ total_bytes: 0, arquivos: 0 });

    let total = 0, count = 0;
    for (const f of fs.readdirSync(chatDir)) {
      try { total += fs.statSync(path.join(chatDir, f)).size; count++; } catch {}
    }
    res.json({ total_bytes: total, arquivos: count });
  } catch (e) { res.status(500).json({ error: 'Erro interno' }); }
};
