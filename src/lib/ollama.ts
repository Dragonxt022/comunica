const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma3:1b';
// Modelos locais podem demorar (cold start + geração). Configurável via OLLAMA_TIMEOUT_MS.
const TIMEOUT_MS = parseInt(process.env.OLLAMA_TIMEOUT_MS || '180000', 10);
// Raciocínio (thinking) desligado por padrão — modelos como qwen3 "pensam" e ficam lentos.
const THINK = (process.env.OLLAMA_THINK || 'false') === 'true';

/**
 * Envia um POST ao Ollama. Desliga o "thinking" por padrão (mais rápido). Se o
 * modelo não suportar o parâmetro `think`, tenta novamente sem ele.
 */
async function postOllama(pathName: string, baseBody: Record<string, any>, timeoutMs: number): Promise<any> {
  const attempt = async (body: Record<string, any>) => {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${OLLAMA_HOST}${pathName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null) as { error?: string } | null;
        const err = new Error((b && b.error) || `Ollama respondeu ${res.status}`);
        (err as any).status = res.status;
        throw err;
      }
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  };

  try {
    return await attempt({ ...baseBody, think: THINK });
  } catch (e: any) {
    // Alguns modelos não aceitam o parâmetro 'think' — repete sem ele.
    if (/think/i.test(e?.message || '')) return await attempt(baseBody);
    throw e;
  }
}

export async function ollamaGenerate(prompt: string, system?: string, model?: string): Promise<string> {
  const data = await postOllama('/api/generate', { model: model || OLLAMA_MODEL, prompt, system, stream: false }, TIMEOUT_MS) as { response?: string };
  return (data.response || '').trim();
}

const VISION_TIMEOUT_MS = 180_000;

/**
 * Geração com uma ou mais imagens (modelos de visão, ex.: gemma3/gemma4, llava, qwen-vl).
 * As imagens devem ser enviadas em base64 (sem o prefixo data:).
 */
export async function ollamaGenerateImages(prompt: string, images: string[], system?: string, model?: string): Promise<string> {
  const data = await postOllama('/api/generate', { model: model || OLLAMA_MODEL, prompt, system, images, stream: false }, VISION_TIMEOUT_MS) as { response?: string };
  return (data.response || '').trim();
}

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export async function ollamaChat(mensagens: ChatMessage[], model?: string): Promise<string> {
  const data = await postOllama('/api/chat', { model: model || OLLAMA_MODEL, messages: mensagens, stream: false }, TIMEOUT_MS) as { message?: { content?: string } };
  return (data.message?.content || '').trim();
}

export async function ollamaListModels(): Promise<{ name: string; cloud: boolean; size: number }[]> {
  const res = await fetch(`${OLLAMA_HOST}/api/tags`);
  if (!res.ok) throw new Error(`Ollama respondeu ${res.status}`);
  const data = await res.json() as { models?: { name: string; size: number }[] };
  return (data.models || []).map(m => ({ name: m.name, cloud: m.name.includes(':cloud') || m.name.endsWith('-cloud'), size: m.size }));
}
