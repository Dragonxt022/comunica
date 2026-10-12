/**
 * Validador automático de composições. Classifica os problemas em:
 *  - bloqueadores: impedem a aprovação;
 *  - avisos: exigem conferência, mas permitem continuar.
 */

import type { Campo, ComposicaoInput, ResultadoComposicao, Variante, ElTexto, ElImagem } from './types.ts';
import { resolverCor, razaoContraste, normalizarHex, validarPaleta } from './paletas.ts';

export type NivelProblema = 'bloqueador' | 'aviso';

export interface Problema {
  nivel: NivelProblema;
  codigo: string;
  mensagem: string;
  elementoId?: string;
}

export interface ResultadoValidacao {
  bloqueadores: Problema[];
  avisos: Problema[];
  ok: boolean;
}

export interface ValidacaoEntrada {
  variante: Variante;
  varianteEsperada?: { largura: number; altura: number };
  campos: Campo[];
  dados: Record<string, string>;
  paleta: Record<string, string>;
  composicao: ResultadoComposicao;
  imagensResolvidas?: Record<string, string>;
  contrasteMinimo?: number;
}

const MIN_CONTRASTE_PADRAO = 4.5;

export function validarComposicao(entrada: ValidacaoEntrada): ResultadoValidacao {
  const bloqueadores: Problema[] = [];
  const avisos: Problema[] = [];
  const { variante, campos, dados, paleta, composicao } = entrada;
  const contrasteMin = entrada.contrasteMinimo ?? MIN_CONTRASTE_PADRAO;

  // 1. Dimensões / proporção
  if (!variante.largura || !variante.altura || variante.largura <= 0 || variante.altura <= 0) {
    bloqueadores.push({ nivel: 'bloqueador', codigo: 'dimensao', mensagem: 'Dimensões da variante inválidas.' });
  }
  if (entrada.varianteEsperada &&
    (variante.largura !== entrada.varianteEsperada.largura || variante.altura !== entrada.varianteEsperada.altura)) {
    bloqueadores.push({ nivel: 'bloqueador', codigo: 'formato', mensagem: 'A composição não corresponde ao formato selecionado.' });
  }

  // 2. Paleta
  const errosPaleta = validarPaleta(paleta);
  for (const e of errosPaleta) avisos.push({ nivel: 'aviso', codigo: 'paleta', mensagem: e });

  // 3. Campos obrigatórios
  for (const campo of campos) {
    if (!campo.obrigatorio) continue;
    const v = dados[campo.chave];
    if (v === undefined || v === null || String(v).trim() === '') {
      bloqueadores.push({
        nivel: 'bloqueador',
        codigo: 'campo_obrigatorio',
        mensagem: `Campo obrigatório vazio: ${campo.rotulo || campo.chave}.`,
      });
    }
  }

  // 4. Imagens ausentes (via mapa de imagens já resolvidas, quando informado)
  if (entrada.imagensResolvidas) {
    bloqueadores.push(...validarImagens(variante.elementos, entrada.imagensResolvidas));
  }

  // 5. Diagnósticos de texto + contraste
  const diagPorId = new Map(composicao.textoDiagnostico.map((d) => [d.elementoId, d]));
  for (const el of variante.elementos) {
    if (el.tipo !== 'texto') continue;
    const t = el as ElTexto;
    const d = diagPorId.get(t.id);

    if (d) {
      if (d.truncou) {
        bloqueadores.push({
          nivel: 'bloqueador', codigo: 'texto_cortado', elementoId: t.id,
          mensagem: 'Texto obrigatório cortado por exceder o limite de linhas.',
        });
      } else if (d.excedeu) {
        bloqueadores.push({
          nivel: 'bloqueador', codigo: 'texto_excedeu', elementoId: t.id,
          mensagem: 'Texto não cabe na área mesmo no tamanho mínimo de fonte.',
        });
      } else if (d.reduziu && d.fontSize <= d.fontSizeMin) {
        avisos.push({
          nivel: 'aviso', codigo: 'texto_no_limite', elementoId: t.id,
          mensagem: 'Texto próximo do limite — a fonte foi reduzida ao mínimo permitido.',
        });
      }
    }

    // Contraste do texto contra o fundo informado
    const corTexto = resolverCor(t.cor || 'text', paleta);
    const corFundo = resolverCor('background', paleta);
    const ratio = razaoContraste(corTexto, corFundo);
    if (ratio < contrasteMin) {
      avisos.push({
        nivel: 'aviso', codigo: 'contraste', elementoId: t.id,
        mensagem: `Contraste do texto abaixo do mínimo (${ratio.toFixed(2)}:1 < ${contrasteMin}:1).`,
      });
    }
  }

  return { bloqueadores, avisos, ok: bloqueadores.length === 0 };
}

// O resultado da composição não carrega quais imagens foram resolvidas; usamos
// a lista de imagens resolvidas informada pelo controller (map elementoId -> data URI).

/** Marca quais elementos de imagem possuem arquivo disponível. */
export function validarImagens(elementos: Variante['elementos'], imagensResolvidas: Record<string, string>): Problema[] {
  const problemas: Problema[] = [];
  for (const el of elementos) {
    if (el.tipo !== 'imagem') continue;
    const img = el as ElImagem;
    if (!imagensResolvidas[img.id]) {
      const ref = img.placeholder || img.url || (img.ativoId ? `ativo #${img.ativoId}` : 'imagem');
      problemas.push({
        nivel: 'bloqueador', codigo: 'imagem_ausente', elementoId: img.id,
        mensagem: `Imagem ausente ou não carregada: ${ref}.`,
      });
    }
  }
  return problemas;
}

export { normalizarHex };
