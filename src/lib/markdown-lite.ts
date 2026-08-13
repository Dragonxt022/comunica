import sanitizeHtml from 'sanitize-html';

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'ul', 'ol', 'li', 'a'],
  allowedAttributes: { a: ['href'] },
  allowedSchemes: [],
  allowProtocolRelative: false,
  exclusiveFilter: (frame) => frame.tag === 'a' && !/^\/(?!\/)/.test(frame.attribs.href || ''),
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Negrito **texto** e link interno [texto](/rota) — só aceita href começando com "/".
function inline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((\/[^)\s]*)\)/g, '<a href="$2">$1</a>');
}

/** Transforma texto simples com **negrito**, listas (1. / -) e [texto](/rota) em HTML seguro. */
export function renderOliviaMarkdown(textoBruto: string): string {
  const texto = escapeHtml(String(textoBruto || ''));
  const linhas = texto.split(/\r?\n/);

  const blocos: string[] = [];
  let listaAtual: { tipo: 'ol' | 'ul'; itens: string[] } | null = null;
  let paragrafoAtual: string[] = [];

  function fecharLista() {
    if (listaAtual) {
      const tag = listaAtual.tipo;
      blocos.push(`<${tag}>${listaAtual.itens.map((i) => `<li>${i}</li>`).join('')}</${tag}>`);
      listaAtual = null;
    }
  }
  function fecharParagrafo() {
    if (paragrafoAtual.length) {
      blocos.push(`<p>${paragrafoAtual.join('<br>')}</p>`);
      paragrafoAtual = [];
    }
  }

  for (const linhaRaw of linhas) {
    const linha = linhaRaw.trim();
    if (!linha) {
      fecharParagrafo();
      fecharLista();
      continue;
    }
    const numerada = linha.match(/^\d+[.)]\s+(.*)$/);
    const marcada = linha.match(/^[-*]\s+(.*)$/);
    if (numerada) {
      fecharParagrafo();
      if (!listaAtual || listaAtual.tipo !== 'ol') { fecharLista(); listaAtual = { tipo: 'ol', itens: [] }; }
      listaAtual.itens.push(inline(numerada[1]));
    } else if (marcada) {
      fecharParagrafo();
      if (!listaAtual || listaAtual.tipo !== 'ul') { fecharLista(); listaAtual = { tipo: 'ul', itens: [] }; }
      listaAtual.itens.push(inline(marcada[1]));
    } else {
      fecharLista();
      paragrafoAtual.push(inline(linha));
    }
  }
  fecharParagrafo();
  fecharLista();

  return sanitizeHtml(blocos.join(''), SANITIZE_OPTIONS);
}
