import { ollamaGenerate, ollamaGenerateImages, ollamaListModels } from './ollama.ts';

export type ItemIndicador = {
  indicador: string;
  descricao?: string;
  valor_meta?: number;
  valor_atual?: number;
  unidade?: string;
};

export type ItemAcao = {
  titulo: string;
  descricao?: string;
  objetivo?: string;
  responsavel_nome?: string;
  prazo?: string | null;
  prioridade?: string;
};

export type ItemEvento = {
  titulo: string;
  descricao?: string;
  local?: string;
  data_inicio?: string | null;
  data_fim?: string | null;
  tipo?: string;
};

export type DocumentoExtraido = {
  indicadores: ItemIndicador[];
  acoes: ItemAcao[];
  eventos: ItemEvento[];
};

const PROMPT = `Você recebe a imagem de um documento de planejamento (ofício, plano de ação, cronograma, ata, lista de metas etc.). Extraia as informações estruturadas que aparecerem.

Responda APENAS com um JSON válido (sem texto antes, depois, sem markdown, sem comentários), exatamente neste formato:
{
  "indicadores": [ { "indicador": "", "descricao": "", "valor_meta": 0, "valor_atual": 0, "unidade": "" } ],
  "acoes": [ { "titulo": "", "descricao": "", "objetivo": "", "responsavel_nome": "", "prazo": "YYYY-MM-DD", "prioridade": "baixa|media|alta" } ],
  "eventos": [ { "titulo": "", "descricao": "", "local": "", "data_inicio": "YYYY-MM-DDTHH:MM", "data_fim": "YYYY-MM-DDTHH:MM", "tipo": "" } ]
}

Regras:
- Se uma categoria não aparecer, retorne um array vazio [].
- Use null quando um valor não estiver disponível.
- Não invente informações que não estejam na imagem.
- Mantenha o texto no idioma original (português).`;

const PROMPT_TEXTO = `Você recebe o TEXTO extraído de um documento de planejamento (ofício, plano de ação, cronograma, ata, lista de metas etc.). Extraia as informações estruturadas que aparecerem.

Responda APENAS com um JSON válido (sem texto antes, depois, sem markdown, sem comentários), exatamente neste formato:
{
  "indicadores": [ { "indicador": "", "descricao": "", "valor_meta": 0, "valor_atual": 0, "unidade": "" } ],
  "acoes": [ { "titulo": "", "descricao": "", "objetivo": "", "responsavel_nome": "", "prazo": "YYYY-MM-DD", "prioridade": "baixa|media|alta" } ],
  "eventos": [ { "titulo": "", "descricao": "", "local": "", "data_inicio": "YYYY-MM-DDTHH:MM", "data_fim": "YYYY-MM-DDTHH:MM", "tipo": "" } ]
}

Regras:
- Se uma categoria não aparecer, retorne um array vazio [].
- Use null quando um valor não estiver disponível.
- Não invente informações que não estejam no texto.
- Mantenha o texto no idioma original (português).

TEXTO DO DOCUMENTO:
---
`;

/**
 * Escolhe um modelo com suporte a visão: variável de ambiente OLLAMA_VISION_MODEL,
 * senão o primeiro modelo instalado com cara de visão, senão o modelo de perfil.
 */
export async function escolherModeloVisao(modeloFallback: string): Promise<string> {
  const env = (process.env.OLLAMA_VISION_MODEL || '').trim();
  if (env) return env;

  try {
    const models = await ollamaListModels();
    const re = /(vision|llava|minicpm|moondream|\bvl\b|qwen.*vl|gemma3:(4b|12b|27b)|gemma4)/i;
    const hit = models.find(m => re.test(m.name));
    if (hit) return hit.name;
  } catch {
    /* Ollama indisponível — usa fallback */
  }

  return modeloFallback;
}

/** Extrai o primeiro objeto JSON de um texto (tolera cercas de código e texto extra). */
export function parseDocumento(texto: string): DocumentoExtraido {
  const vazio: DocumentoExtraido = { indicadores: [], acoes: [], eventos: [] };
  if (!texto) return vazio;

  let candidato = texto.trim();
  const cerca = candidato.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (cerca) candidato = cerca[1].trim();

  const inicio = candidato.indexOf('{');
  const fim = candidato.lastIndexOf('}');
  if (inicio < 0 || fim < 0 || fim <= inicio) return vazio;

  try {
    const obj = JSON.parse(candidato.slice(inicio, fim + 1));
    const arr = (v: any) => (Array.isArray(v) ? v : []);
    return {
      indicadores: arr(obj.indicadores),
      acoes: arr(obj.acoes),
      eventos: arr(obj.eventos),
    };
  } catch {
    return vazio;
  }
}

/** Analisa uma imagem (base64, sem prefixo data:) e devolve as informações extraídas. */
export async function analisarImagem(base64: string, modelo: string, systemPrompt?: string): Promise<DocumentoExtraido> {
  const resposta = await ollamaGenerateImages(PROMPT, [base64], systemPrompt, modelo);
  return parseDocumento(resposta);
}

/** Limite de caracteres enviados ao modelo para não estourar o contexto. */
const LIMITE_TEXTO = 24000;

/** Analisa o texto (colado ou extraído de um PDF) e devolve as informações extraídas. */
export async function analisarTexto(texto: string, modelo: string, systemPrompt?: string): Promise<DocumentoExtraido> {
  const conteudo = (texto || '').trim();
  if (!conteudo) return { indicadores: [], acoes: [], eventos: [] };
  const trecho = conteudo.length > LIMITE_TEXTO ? conteudo.slice(0, LIMITE_TEXTO) : conteudo;
  const resposta = await ollamaGenerate(`${PROMPT_TEXTO}${trecho}`, systemPrompt, modelo);
  return parseDocumento(resposta);
}

/**
 * Extrai o texto de um PDF com camada de texto. Retorna '' para PDFs digitalizados
 * (imagens sem texto selecionável), que precisam ser enviados como imagem/OCR.
 */
export async function extrairTextoPdf(buffer: Buffer): Promise<string> {
  // pdf.js usa Promise.withResolvers (Node 22+). Polyfill para manter Node 20 funcional.
  if (typeof (Promise as any).withResolvers !== 'function') {
    (Promise as any).withResolvers = function withResolvers() {
      let resolve: any, reject: any;
      const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
      return { promise, resolve, reject };
    };
  }

  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const resultado = await parser.getText();
    return (resultado?.text || '').trim();
  } finally {
    await parser.destroy().catch(() => {});
  }
}

/** Junta os resultados de várias páginas/imagens em um único conjunto. */
export function mergeDocumentos(resultados: DocumentoExtraido[]): DocumentoExtraido {
  return {
    indicadores: resultados.flatMap(r => r.indicadores || []),
    acoes: resultados.flatMap(r => r.acoes || []),
    eventos: resultados.flatMap(r => r.eventos || []),
  };
}
