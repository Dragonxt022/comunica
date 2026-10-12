/**
 * Quebra de linha e ajuste de texto — determinístico e independente de
 * bibliotecas externas, para que o mesmo template+dados produza o mesmo SVG.
 *
 * A largura é estimada por uma métrica ponderada por caractere (não exige
 * medição real de fonte), suficiente para o ajuste dentro das áreas seguras.
 */

import type { EstiloTexto } from './types.ts';

// Pesos aproximados de largura por caractere (fração do tamanho da fonte).
const LARGOS = new Set('MWmw@#%&'.split(''));
const ESTREITOS = new Set("iIlJjtf.,:;'!|`[](){}".split(''));

export function larguraAproxTexto(texto: string, fontSize: number, espacamentoLetras = 0): number {
  let total = 0;
  for (const ch of texto) {
    let fator = 0.55;
    if (LARGOS.has(ch)) fator = 0.92;
    else if (ESTREITOS.has(ch)) fator = 0.3;
    else if (ch === ' ') fator = 0.28;
    else if (ch >= '0' && ch <= '9') fator = 0.58;
    else if (ch >= 'A' && ch <= 'Z') fator = 0.66;
    total += fator * fontSize + espacamentoLetras;
  }
  return total;
}

/**
 * Quebra o texto respeitando larguras. Mantém quebras explícitas (\n) e
 * quebra palavras longas que não caibam sozinhas.
 */
export function quebrarLinhas(texto: string, larguraMax: number, fontSize: number, espacamentoLetras = 0): string[] {
  const resultado: string[] = [];
  const paragrafos = String(texto ?? '').replace(/\r/g, '').split('\n');

  for (const paragrafo of paragrafos) {
    const palavras = paragrafo.split(/\s+/).filter((p) => p.length > 0);
    if (palavras.length === 0) { resultado.push(''); continue; }

    let linha = '';
    for (const palavra of palavras) {
      const tentativa = linha ? `${linha} ${palavra}` : palavra;
      if (larguraAproxTexto(tentativa, fontSize, espacamentoLetras) <= larguraMax) {
        linha = tentativa;
      } else {
        if (linha) resultado.push(linha);
        // Palavra maior que a largura: quebra por caractere.
        if (larguraAproxTexto(palavra, fontSize, espacamentoLetras) > larguraMax) {
          let pedaco = '';
          for (const ch of palavra) {
            if (larguraAproxTexto(pedaco + ch, fontSize, espacamentoLetras) > larguraMax && pedaco) {
              resultado.push(pedaco);
              pedaco = ch;
            } else {
              pedaco += ch;
            }
          }
          linha = pedaco;
        } else {
          linha = palavra;
        }
      }
    }
    resultado.push(linha);
  }
  return resultado;
}

export interface AjusteTexto {
  linhas: string[];
  fontSize: number;
  reduziu: boolean;
  excedeu: boolean;
  truncou: boolean;
}

/**
 * Ajusta o texto à área disponível seguindo a ordem do plano:
 * quebra de linha → reduzir até o mínimo → sinalizar excesso → cortar se configurado.
 * Nunca reduz abaixo de `tamanhoMin`.
 */
export function ajustarTexto(
  texto: string,
  largura: number,
  alturaDisponivel: number | null,
  estilo: EstiloTexto
): AjusteTexto {
  const larguraUtil = Math.max(1, largura - 2 * (estilo.margem || 0));
  let fontSize = estilo.tamanho;
  let linhas = quebrarLinhas(texto, larguraUtil, fontSize, estilo.espacamentoLetras);
  let reduziu = false;

  const cabe = (n: number) =>
    (!alturaDisponivel || n * fontSize * estilo.alturaLinha <= alturaDisponivel);

  let excedeuLinhas = estilo.limiteLinhas ? linhas.length > estilo.limiteLinhas : false;

  while (fontSize > estilo.tamanhoMin && (!cabe(linhas.length) || excedeuLinhas)) {
    fontSize = Math.max(estilo.tamanhoMin, Math.round(fontSize - 2));
    reduziu = true;
    linhas = quebrarLinhas(texto, Math.max(1, largura - 2 * (estilo.margem || 0)), fontSize, estilo.espacamentoLetras);
    excedeuLinhas = estilo.limiteLinhas ? linhas.length > estilo.limiteLinhas : false;
  }

  let excedeu = !cabe(linhas.length) || excedeuLinhas;
  let truncou = false;

  if (estilo.limiteLinhas && linhas.length > estilo.limiteLinhas) {
    if (estilo.overflow === 'cortar') {
      linhas = linhas.slice(0, estilo.limiteLinhas);
      if (linhas.length) linhas[linhas.length - 1] = linhas[linhas.length - 1].replace(/\s+$/, '') + '…';
      truncou = true;
    }
  }

  return { linhas, fontSize, reduziu, excedeu, truncou };
}

/** Escapa texto para XML/SVG. */
export function escaparXml(texto: string): string {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
