/**
 * Motor determinístico de composição: transforma template + dados + paleta
 * + estilos em um SVG reproduzível. O mesmo conjunto de entradas produz
 * sempre o mesmo SVG.
 */

import type {
  ComposicaoInput, DiagnosticoTexto, Elemento, ElImagem, ElTexto,
  EstiloTexto, ResultadoComposicao, Variante,
} from './types.ts';
import { resolverCor, comOpacidade } from './paletas.ts';
import { ajustarTexto, escaparXml } from './texto.ts';

export const ESTILO_PADRAO: EstiloTexto = {
  familia: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
  peso: 700,
  tamanho: 64,
  tamanhoMin: 28,
  alturaLinha: 1.15,
  espacamentoLetras: 0,
  alinhamento: 'left',
  cor: 'text',
  limiteLinhas: null,
  margem: 0,
  overflow: 'avisar',
};

/** Substitui {{campo}} pelos valores informados. */
export function interpolar(valor: string, dados: Record<string, string>): string {
  return String(valor ?? '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, chave) => {
    const v = dados[chave];
    return v === undefined || v === null ? '' : String(v);
  });
}

function resolverEstilo(el: ElTexto, estilos: Record<number, EstiloTexto>): EstiloTexto {
  const base = el.estiloId && estilos[el.estiloId] ? estilos[el.estiloId] : ESTILO_PADRAO;
  return { ...base, ...(el.estilo || {}) };
}

function renderTexto(el: ElTexto, input: ComposicaoInput, diag: DiagnosticoTexto[]): string {
  const estilo = resolverEstilo(el, input.estilos);
  const corRef = el.cor || estilo.cor;
  const cor = resolverCor(corRef, input.paleta);
  const bruto = el.variavel && !el.valor ? (input.dados[el.variavel] ?? '') : interpolar(el.valor, input.dados);
  const texto = String(bruto ?? '').trim();
  if (!texto) return '';

  const ajuste = ajustarTexto(texto, el.w, null, estilo);
  const lh = ajuste.fontSize * estilo.alturaLinha;
  const anchor = estilo.alinhamento === 'center' ? 'middle' : estilo.alinhamento === 'right' ? 'end' : 'start';
  const x = estilo.alinhamento === 'center' ? el.x + el.w / 2 : estilo.alinhamento === 'right' ? el.x + el.w : el.x + estilo.margem;
  const primeiraBase = el.y + ajuste.fontSize * 0.85 + estilo.margem;

  const tspans = ajuste.linhas.map((linha, i) => {
    const dy = i === 0 ? 0 : lh;
    return `<tspan x="${x}" dy="${i === 0 ? 0 : dy}">${escaparXml(linha)}</tspan>`;
  }).join('');

  const clipId = `txt-${el.id}`;
  const clipH = Math.max(ajuste.fontSize * estilo.alturaLinha, input.variante.altura - el.y - 2);
  const clip = `<defs><clipPath id="${clipId}"><rect x="${el.x}" y="${el.y - 2}" width="${el.w}" height="${clipH}"/></clipPath></defs>`;

  diag.push({
    elementoId: el.id,
    linhas: ajuste.linhas.length,
    limiteLinhas: estilo.limiteLinhas,
    fontSize: ajuste.fontSize,
    fontSizeMin: estilo.tamanhoMin,
    reduziu: ajuste.reduziu,
    excedeu: ajuste.excedeu,
    truncou: ajuste.truncou,
  });

  return `${clip}<text x="${x}" y="${primeiraBase}" font-family="${escaparXml(estilo.familia)}" font-size="${ajuste.fontSize}" font-weight="${estilo.peso}" letter-spacing="${estilo.espacamentoLetras}" fill="${cor}" text-anchor="${anchor}" clip-path="url(#${clipId})">${tspans}</text>`;
}

function renderImagem(el: ElImagem, input: ComposicaoInput): string {
  const dataUri = input.imagens[el.id];
  const op = el.opacidade ?? 1;
  if (!dataUri) return '';
  const clipId = `clip-${el.id}`;
  const preserve = el.ajuste === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice';
  const clip = el.raio
    ? `<clipPath id="${clipId}"><rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="${el.raio}" ry="${el.raio}"/></clipPath>`
    : `<clipPath id="${clipId}"><rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}"/></clipPath>`;
  return `<defs>${clip}</defs><image href="${dataUri}" x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" preserveAspectRatio="${preserve}" clip-path="url(#${clipId})" opacity="${op}"/>`;
}

function renderElemento(el: Elemento, input: ComposicaoInput, diag: DiagnosticoTexto[]): string {
  const interno = renderElementoBase(el, input, diag);
  if (!interno || !el.sombra) return interno;
  const s = el.sombra;
  const cor = resolverCor(s.cor || 'text', input.paleta);
  const dx = s.x != null ? s.x : 6;
  const dy = s.y != null ? s.y : 6;
  const blur = s.blur != null ? s.blur : 6;
  const op = s.opacidade != null ? s.opacidade : 0.45;
  const id = `sh-${el.id}`;
  return `<defs><filter id="${id}" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="${dx}" dy="${dy}" stdDeviation="${blur}" flood-color="${cor}" flood-opacity="${op}"/></filter></defs><g filter="url(#${id})">${interno}</g>`;
}

function renderElementoBase(el: Elemento, input: ComposicaoInput, diag: DiagnosticoTexto[]): string {
  const op = el.opacidade ?? 1;
  const opAttr = op < 1 ? ` opacity="${op}"` : '';
  switch (el.tipo) {
    case 'retangulo': {
      const fill = resolverCor(el.fill, input.paleta);
      const raio = el.raio ? ` rx="${el.raio}" ry="${el.raio}"` : '';
      return `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}"${raio} fill="${fill}"${opAttr}/>`;
    }
    case 'circulo': {
      const fill = resolverCor(el.fill, input.paleta);
      return `<circle cx="${el.cx}" cy="${el.cy}" r="${el.r}" fill="${fill}"${opAttr}/>`;
    }
    case 'linha': {
      const cor = resolverCor(el.cor, input.paleta);
      return `<line x1="${el.x1}" y1="${el.y1}" x2="${el.x2}" y2="${el.y2}" stroke="${cor}" stroke-width="${el.espessura}"${opAttr}/>`;
    }
    case 'imagem':
      return renderImagem(el, input);
    case 'texto':
      return renderTexto(el, input, diag);
    default:
      return '';
  }
}

/** Compõe a variante em um SVG completo. */
export function compor(input: ComposicaoInput): ResultadoComposicao {
  const { variante, paleta } = input;
  const largura = variante.largura;
  const altura = variante.altura;
  const diag: DiagnosticoTexto[] = [];

  const fundo = resolverCor(variante.fundo || 'background', paleta);
  const partes: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}">`,
    `<rect x="0" y="0" width="${largura}" height="${altura}" fill="${fundo}"/>`,
  ];

  const ordenados = [...variante.elementos].sort((a, b) => (a.camada - b.camada));
  for (const el of ordenados) {
    if (el.oculto) continue;
    const svg = renderElemento(el, input, diag);
    if (svg) partes.push(svg);
  }

  partes.push('</svg>');
  return { svg: partes.join('\n'), largura, altura, textoDiagnostico: diag };
}

/** Campos dinâmicos que aparecem em uma variante (para o editor de produção). */
export function variaveisDaVariante(variante: Variante): string[] {
  const set = new Set<string>();
  for (const el of variante.elementos) {
    if (el.tipo !== 'texto') continue;
    const t = el as ElTexto;
    if (t.variavel) set.add(t.variavel);
    for (const m of String(t.valor || '').matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) set.add(m[1]);
  }
  return Array.from(set);
}

export { comOpacidade };
