const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma3:1b';
const TIMEOUT_MS = 30_000;

export async function ollamaGenerate(prompt: string, system?: string, model?: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || OLLAMA_MODEL,
        prompt,
        system,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null) as { error?: string } | null;
      throw new Error(body?.error || `Ollama respondeu ${res.status}`);
    }

    const data = await res.json() as { response?: string };
    return (data.response || '').trim();
  } finally {
    clearTimeout(timeout);
  }
}

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export async function ollamaChat(mensagens: ChatMessage[], model?: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || OLLAMA_MODEL,
        messages: mensagens,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null) as { error?: string } | null;
      throw new Error(body?.error || `Ollama respondeu ${res.status}`);
    }

    const data = await res.json() as { message?: { content?: string } };
    return (data.message?.content || '').trim();
  } finally {
    clearTimeout(timeout);
  }
}

export async function ollamaListModels(): Promise<{ name: string; cloud: boolean; size: number }[]> {
  const res = await fetch(`${OLLAMA_HOST}/api/tags`);
  if (!res.ok) throw new Error(`Ollama respondeu ${res.status}`);
  const data = await res.json() as { models?: { name: string; size: number }[] };
  return (data.models || []).map(m => ({ name: m.name, cloud: m.name.includes(':cloud') || m.name.endsWith('-cloud'), size: m.size }));
}
