import sanitizeHtml from 'sanitize-html';

const options: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'em', 'u', 's', 'h2', 'h3', 'ul', 'ol', 'li', 'a', 'span'],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    span: ['class'],
    p: ['class'],
  },
  allowedClasses: {
    span: ['ql-align-center', 'ql-align-right', 'ql-align-justify'],
    p: ['ql-align-center', 'ql-align-right', 'ql-align-justify'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }),
  },
};

export function sanitizeDescricao(html: string): string {
  return sanitizeHtml(html || '', options);
}

const TEM_ESTRUTURA_HTML = /<(p|br|ul|ol|li|h2|h3)[\s/>]/i;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Descrições salvas antes do editor Quill (via textarea simples) são texto puro com
 * quebras de linha (`\n`), sem tags — ao injetar isso direto num `.rich-content`, o
 * navegador colapsa as quebras e tudo vira um parágrafo só. Aqui a gente detecta esse
 * caso e envolve as linhas em `<p>`/`<br>` antes de sanitizar, preservando a formatação
 * original. Texto que já veio do Quill (com tags de bloco) passa direto pelo sanitizer.
 */
export function normalizeDescricao(texto: string): string {
  const bruto = texto || '';
  if (TEM_ESTRUTURA_HTML.test(bruto)) return sanitizeDescricao(bruto);

  const html = bruto
    .split(/\n{2,}/)
    .map((paragrafo) => escapeHtml(paragrafo.trim()).replace(/\n/g, '<br>'))
    .filter((p) => p.length > 0)
    .map((p) => `<p>${p}</p>`)
    .join('');

  return sanitizeDescricao(html);
}
