import { Request, Response } from 'express';
import { IaPerfil } from '../../database/models/index.ts';
import { ollamaGenerate, ollamaListModels } from '../../lib/ollama.ts';

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
