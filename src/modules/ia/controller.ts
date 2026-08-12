import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { IaPerfil, Solicitacao, Evento, Secretaria } from '../../database/models/index.ts';
import { ollamaGenerate, ollamaListModels, ollamaChat, ChatMessage } from '../../lib/ollama.ts';
import { secretariaWhere, municipioWhere, getActiveMid } from '../../lib/municipio-filter.ts';

function stripHtml(html: string): string {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

const DEFAULT_PROMPT = 'Você é um assistente de comunicação de uma prefeitura municipal. Responda sempre em português do Brasil, de forma clara, objetiva e profissional.';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'gemma3:1b';

async function getIaConfig(): Promise<{ systemPrompt: string; modelo: string }> {
  const perfil = await IaPerfil.findOne({ where: { id: 1 } });
  if (!perfil || !perfil.ativo) return { systemPrompt: DEFAULT_PROMPT, modelo: DEFAULT_MODEL };
  return { systemPrompt: perfil.system_prompt || DEFAULT_PROMPT, modelo: perfil.modelo || DEFAULT_MODEL };
}

// Se o modelo configurado for de nuvem e falhar (créditos/assinatura/rede), cai para o modelo local.
async function gerarComFallback(prompt: string, system: string, modelo: string): Promise<{ texto: string; usouFallback: boolean }> {
  try {
    const texto = await ollamaGenerate(prompt, system, modelo);
    return { texto, usouFallback: false };
  } catch (error) {
    const isCloud = modelo.includes('cloud');
    if (!isCloud || modelo === DEFAULT_MODEL) throw error;
    const texto = await ollamaGenerate(prompt, system, DEFAULT_MODEL);
    return { texto, usouFallback: true };
  }
}

// ── Perfil de IA (comportamento/persona) ──────────────────────────────────────

export const perfilView = async (req: Request, res: Response) => {
  try {
    const [perfil] = await IaPerfil.findOrCreate({
      where: { id: 1 },
      defaults: { system_prompt: DEFAULT_PROMPT, ativo: true, modelo: DEFAULT_MODEL } as any,
    });
    let modelosDisponiveis: { name: string; cloud: boolean; size: number }[] = [];
    try {
      modelosDisponiveis = await ollamaListModels();
    } catch { /* Ollama indisponível — formulário ainda funciona com texto livre */ }
    res.render('ia/perfil', { title: 'Assistente IA', perfil, modelosDisponiveis, success: false });
  } catch (error) {
    console.error('Error loading IA perfil:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const savePerfil = async (req: Request, res: Response) => {
  try {
    const { system_prompt, ativo, modelo } = req.body;
    const [perfil] = await IaPerfil.findOrCreate({ where: { id: 1 }, defaults: {} as any });
    await perfil.update({
      system_prompt: system_prompt || DEFAULT_PROMPT,
      ativo: ativo === 'on' || ativo === '1',
      modelo: modelo || DEFAULT_MODEL,
    });
    let modelosDisponiveis: { name: string; cloud: boolean; size: number }[] = [];
    try {
      modelosDisponiveis = await ollamaListModels();
    } catch { /* Ollama indisponível */ }
    res.render('ia/perfil', { title: 'Assistente IA', perfil, modelosDisponiveis, success: true });
  } catch (error) {
    console.error('Error saving IA perfil:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const testarModelo = async (req: Request, res: Response) => {
  try {
    const modelo = String(req.body.modelo || '').trim();
    if (!modelo) return res.status(400).json({ ok: false, error: 'Informe um modelo.' });
    const start = Date.now();
    const resposta = await ollamaGenerate('Responda apenas com a palavra: OK', undefined, modelo);
    res.json({ ok: true, resposta, tempoMs: Date.now() - start });
  } catch (error: any) {
    res.json({ ok: false, error: error?.message || 'Falha ao testar o modelo.' });
  }
};

// Mesmo padrão de fallback nuvem→local de gerarComFallback, para o endpoint de chat.
async function gerarComFallbackChat(mensagens: ChatMessage[], modelo: string): Promise<{ texto: string; usouFallback: boolean }> {
  try {
    const texto = await ollamaChat(mensagens, modelo);
    return { texto, usouFallback: false };
  } catch (error) {
    const isCloud = modelo.includes('cloud');
    if (!isCloud || modelo === DEFAULT_MODEL) throw error;
    const texto = await ollamaChat(mensagens, DEFAULT_MODEL);
    return { texto, usouFallback: true };
  }
}

// ── Sugestões de texto (usadas em Solicitações) ───────────────────────────────

export const sugerirDescricao = async (req: Request, res: Response) => {
  try {
    const titulo = String(req.body.titulo || '').trim();
    if (!titulo) return res.status(400).json({ error: 'Informe um título primeiro.' });

    const { systemPrompt, modelo } = await getIaConfig();
    const prompt = `Título da solicitação de produção de conteúdo: "${titulo}"\n\nEscreva uma descrição/briefing detalhado para essa solicitação (contexto, público-alvo, informações importantes), em até 5 frases. Responda apenas com o texto da descrição, sem introduções, comentários ou aspas.`;
    const { texto, usouFallback } = await gerarComFallback(prompt, systemPrompt, modelo);
    res.json({ descricao: texto, usouFallback });
  } catch (error) {
    console.error('Erro IA sugerir-descricao:', error);
    res.status(503).json({ error: 'Assistente de IA indisponível no momento.' });
  }
};

const INSTRUCAO_ESTRUTURAR = 'Você está ajudando um servidor municipal a estruturar um briefing completo de solicitação de conteúdo para a equipe de comunicação, a partir de uma conversa livre. Faça perguntas curtas quando faltar informação importante (público-alvo, contexto, prazo, referências) ou, quando já houver informação suficiente, responda com um briefing organizado em parágrafos claros (contexto, objetivo, público-alvo, informações-chave). Responda sempre em português do Brasil, sem saudações, sem comentários fora do briefing e sem markdown.';

export const estruturarChamado = async (req: Request, res: Response) => {
  try {
    const titulo = String(req.body.titulo || '').trim();
    const mensagens = Array.isArray(req.body.mensagens) ? req.body.mensagens : [];
    if (mensagens.length === 0) return res.status(400).json({ error: 'Envie ao menos uma mensagem.' });

    const { systemPrompt, modelo } = await getIaConfig();
    const system = `${systemPrompt}\n\n${INSTRUCAO_ESTRUTURAR}${titulo ? `\n\nTítulo do chamado: "${titulo}"` : ''}`;

    const historico: ChatMessage[] = mensagens
      .slice(-12)
      .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.texto === 'string' && m.texto.trim())
      .map((m: any) => ({ role: m.role, content: String(m.texto).trim() }));

    if (historico.length === 0) return res.status(400).json({ error: 'Envie ao menos uma mensagem.' });

    const { texto, usouFallback } = await gerarComFallbackChat([{ role: 'system', content: system }, ...historico], modelo);
    res.json({ resposta: texto, usouFallback });
  } catch (error) {
    console.error('Erro IA estruturar-chamado:', error);
    res.status(503).json({ error: 'Assistente de IA indisponível no momento.' });
  }
};

export const corrigirTexto = async (req: Request, res: Response) => {
  try {
    const texto = String(req.body.texto || '').trim();
    if (!texto) return res.status(400).json({ error: 'Não há texto para corrigir.' });

    const { systemPrompt, modelo } = await getIaConfig();
    const prompt = `Corrija a ortografia, gramática e clareza do texto abaixo, mantendo o mesmo sentido e tamanho aproximado. Responda apenas com o texto corrigido, sem comentários, introduções ou aspas.\n\nTexto:\n"""${texto}"""`;
    const { texto: corrigido, usouFallback } = await gerarComFallback(prompt, systemPrompt, modelo);
    res.json({ texto: corrigido, usouFallback });
  } catch (error) {
    console.error('Erro IA corrigir-texto:', error);
    res.status(503).json({ error: 'Assistente de IA indisponível no momento.' });
  }
};

// ── Variações de texto por rede social ─────────────────────────────────────────

function extrairSecao(texto: string, marcador: string, proximosMarcadores: string[]): string {
  const inicio = texto.indexOf(marcador);
  if (inicio < 0) return '';
  let fim = texto.length;
  for (const m of proximosMarcadores) {
    const idx = texto.indexOf(m, inicio + marcador.length);
    if (idx >= 0 && idx < fim) fim = idx;
  }
  return texto.slice(inicio + marcador.length, fim).trim();
}

export const variacoesRedesSociais = async (req: Request, res: Response) => {
  try {
    const titulo = String(req.body.titulo || '').trim();
    const descricao = stripHtml(String(req.body.descricao || ''));
    if (!titulo && !descricao) return res.status(400).json({ error: 'Informe título ou descrição.' });

    const { systemPrompt, modelo } = await getIaConfig();
    const prompt = `Título: "${titulo}"\nBriefing: """${descricao || 'Sem descrição adicional — use apenas o título.'}"""\n\nEscreva 3 versões de texto para divulgar esse conteúdo nas redes sociais, uma para cada rede. Responda EXATAMENTE neste formato, sem nada antes ou depois:\n\n### INSTAGRAM\n(tom próximo e envolvente, pode usar emojis com moderação, até 4 frases)\n\n### FACEBOOK\n(um pouco mais informativo e completo, até 5 frases)\n\n### TWITTER\n(direto e curto, no máximo 280 caracteres)`;
    const { texto, usouFallback } = await gerarComFallback(prompt, systemPrompt, modelo);

    const marcadores = ['### INSTAGRAM', '### FACEBOOK', '### TWITTER'];
    const instagram = extrairSecao(texto, '### INSTAGRAM', ['### FACEBOOK', '### TWITTER']);
    const facebook = extrairSecao(texto, '### FACEBOOK', ['### TWITTER']);
    const twitter = extrairSecao(texto, '### TWITTER', []);

    // Se o modelo não seguiu o formato pedido, devolve o texto bruto no primeiro campo em vez de vazio.
    const nenhumaSecaoEncontrada = !instagram && !facebook && !twitter;
    res.json({
      instagram: nenhumaSecaoEncontrada ? texto : instagram,
      facebook,
      twitter,
      usouFallback,
    });
  } catch (error) {
    console.error('Erro IA variacoes-redes-sociais:', error);
    res.status(503).json({ error: 'Assistente de IA indisponível no momento.' });
  }
};

// ── Priorização assistida da fila de solicitações ──────────────────────────────

type ItemFila = { id: number; titulo: string; prioridade: string; prazo: string; atrasada: boolean; secretaria: string; diasAberto: number };

async function buscarItensFilaPendente(where: any, limit = 20): Promise<ItemFila[]> {
  const pendentes = await Solicitacao.findAll({
    where: { ...where, status: 'pendente' },
    include: [{ model: Secretaria, as: 'secretaria' }],
    order: [['createdAt', 'ASC']],
    limit,
  });

  const hoje = new Date();
  return pendentes.map((s: any) => {
    const diasAberto = Math.max(0, Math.round((hoje.getTime() - new Date(s.createdAt).getTime()) / 86_400_000));
    const prazoDate = s.prazo ? new Date(s.prazo + 'T00:00:00') : null;
    const prazoStr = prazoDate ? prazoDate.toLocaleDateString('pt-BR') : 'sem prazo';
    return {
      id: s.id,
      titulo: s.titulo,
      prioridade: s.prioridade,
      prazo: prazoStr,
      atrasada: !!prazoDate && prazoDate < hoje,
      secretaria: s.secretaria?.nome || '—',
      diasAberto,
    };
  });
}

export const priorizarFila = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    if (!['secom', 'super_admin'].includes(user.role)) return res.status(403).json({ error: 'Sem permissão' });
    const mid = getActiveMid(req);
    const where = secretariaWhere(user, {}, mid);

    const itens = await buscarItensFilaPendente(where);

    if (itens.length === 0) {
      return res.json({ ordemSugerida: [], justificativa: 'Não há solicitações pendentes para priorizar no momento.', itens: [] });
    }

    const listaTexto = itens
      .map((it) => `ID=${it.id} | "${it.titulo}" | prioridade: ${it.prioridade} | prazo: ${it.prazo}${it.atrasada ? ' (ATRASADA)' : ''} | aberta há ${it.diasAberto} dia(s) | secretaria: ${it.secretaria}`)
      .join('\n');

    const { systemPrompt, modelo } = await getIaConfig();
    const prompt = `Fila de solicitações de produção de conteúdo pendentes:\n${listaTexto}\n\nSugira a ordem de atendimento, da mais urgente para a menos urgente, considerando a prioridade marcada, o prazo mais próximo e o tempo de espera. Responda EXATAMENTE neste formato, sem nada antes ou depois:\n\nORDEM: <lista dos IDs acima separados por vírgula, do mais urgente ao menos urgente, incluindo TODOS os IDs>\nMOTIVO: <até 3 frases explicando o critério usado>`;
    const { texto, usouFallback } = await gerarComFallback(prompt, systemPrompt, modelo);

    const idsValidos = new Set(itens.map((it) => it.id));
    const ordemMatch = texto.match(/ORDEM:\s*([\d,\s]+)/i);
    const idsExtraidos = ordemMatch
      ? Array.from(new Set((ordemMatch[1].match(/\d+/g) || []).map(Number).filter((id) => idsValidos.has(id))))
      : [];
    // Autocura: acrescenta ao final qualquer id válido que a IA não tenha incluído na ordem sugerida.
    const faltantes = itens.map((it) => it.id).filter((id) => !idsExtraidos.includes(id));
    const ordemSugerida = [...idsExtraidos, ...faltantes];

    const motivoMatch = texto.match(/MOTIVO:\s*([\s\S]+)/i);
    const justificativa = motivoMatch ? motivoMatch[1].trim() : texto.trim();

    res.json({ ordemSugerida, justificativa, itens, usouFallback, limitado: itens.length >= 20 });
  } catch (error) {
    console.error('Erro IA priorizar-fila:', error);
    res.status(503).json({ error: 'Assistente de IA indisponível no momento.' });
  }
};

// ── Resumo diário da fila (iniciativa da IA — só avisa, nunca reordena sozinha) ─

export async function gerarResumoDigestFila(municipioId: number | null): Promise<{
  texto: string; total: number; atrasadas: number; altaPrioridade: number; usouFallback: boolean;
} | null> {
  const where: any = municipioId ? { municipio_id: municipioId } : {};
  const itens = await buscarItensFilaPendente(where);
  if (itens.length === 0) return null;

  const total = itens.length;
  const atrasadas = itens.filter((it) => it.atrasada).length;
  const altaPrioridade = itens.filter((it) => it.prioridade === 'alta').length;

  const listaTexto = itens
    .map((it) => `- "${it.titulo}" | prioridade: ${it.prioridade} | prazo: ${it.prazo}${it.atrasada ? ' (ATRASADA)' : ''} | aberta há ${it.diasAberto} dia(s) | secretaria: ${it.secretaria}`)
    .join('\n');

  const { systemPrompt, modelo } = await getIaConfig();
  const prompt = `Fila de solicitações de produção de conteúdo pendentes hoje:\n${listaTexto}\n\nEscreva um resumo curto (no máximo 3 frases) para notificar a equipe de comunicação sobre o estado da fila: quantas estão pendentes, se há atrasadas ou de alta prioridade, e uma recomendação objetiva de por onde começar. Responda apenas o resumo, sem saudação, sem introdução, sem markdown.`;
  const { texto, usouFallback } = await gerarComFallback(prompt, systemPrompt, modelo);

  return { texto: texto.trim(), total, atrasadas, altaPrioridade, usouFallback };
}

// ── Pauta editorial automática ──────────────────────────────────────────────────

export const pautaEditorial = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const mid = getActiveMid(req);
    const mesParam = String(req.body.mes || '').trim();
    const agora = new Date();
    const [ano, mes] = /^\d{4}-\d{2}$/.test(mesParam) ? mesParam.split('-').map(Number) : [agora.getFullYear(), agora.getMonth() + 1];

    const inicioMes = new Date(ano, mes - 1, 1);
    const fimMes = new Date(ano, mes, 0, 23, 59, 59, 999);
    const mesLabel = inicioMes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    const eventos = await Evento.findAll({
      where: municipioWhere(user, { data_inicio: { [Op.between]: [inicioMes, fimMes] }, arquivado: false }, mid),
      order: [['data_inicio', 'ASC']],
      limit: 15,
    });

    const eventosTexto = eventos.length
      ? eventos.map((e: any) => `- ${new Date(e.data_inicio).toLocaleDateString('pt-BR')}: ${e.titulo}`).join('\n')
      : '(nenhum evento cadastrado neste mês)';

    const { systemPrompt, modelo } = await getIaConfig();
    const prompt = `Mês de referência: ${mesLabel}.\n\nEventos já agendados neste município para o mês:\n${eventosTexto}\n\nSugira uma pauta de conteúdo para as redes sociais e comunicação da prefeitura ao longo desse mês: datas comemorativas, nacionais ou municipais relevantes, e um tema/abordagem sugerido para cada uma. Considere também os eventos já agendados listados acima. Responda apenas com uma lista, uma sugestão por linha, neste formato (sem introdução nem comentário final):\nDD/MM — tema: sugestão breve de abordagem`;
    const { texto, usouFallback } = await gerarComFallback(prompt, systemPrompt, modelo);

    const sugestoes = texto
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !/^(aqui est|segue|pauta editorial|sugest[õo]es)/i.test(l));

    res.json({ mesLabel, sugestoes, usouFallback });
  } catch (error) {
    console.error('Erro IA pauta-editorial:', error);
    res.status(503).json({ error: 'Assistente de IA indisponível no momento.' });
  }
};
