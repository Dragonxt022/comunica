/**
 * Catálogo inicial de modelos do Estúdio de Artes (determinístico).
 *
 * Cinco famílias, cada modelo com três camadas:
 *  - Visual:     paleta + fundo + faixas + detalhes geométricos.
 *  - Estrutural: posição/tamanho dos blocos e ordem de leitura.
 *  - Conteúdo:   campos preenchidos a partir da solicitação ({{...}}).
 *
 * O catálogo é recriado por município (idempotente por slug).
 */

import { ArtePaleta, ArteEstilo, ArteTemplate, ArteTemplateVariante, Municipio } from '../../database/models/index.ts';
import { PALETA_PADRAO } from './paletas.ts';
import type { Elemento, EstiloTexto, Campo } from './types.ts';

const FAM = 'Arial, Helvetica, sans-serif';
function est(over: Partial<EstiloTexto> = {}): Partial<EstiloTexto> {
  return { familia: FAM, peso: 700, tamanho: 40, tamanhoMin: 24, alturaLinha: 1.2, espacamentoLetras: 0, alinhamento: 'center', cor: 'primary', limiteLinhas: null, margem: 0, overflow: 'diminuir', ...over };
}

type TemaModelo = {
  chave: string;
  nome: string;
  categoria: string;
  etiqueta: string;
  descricao: string;
  paleta: Record<string, string>;
  alerta?: boolean;
  carrossel?: boolean;
};

// ── Paletas por família ────────────────────────────────────────────────────
const PAL_ALERTA: Record<string, string> = { primary: '#17365D', secondary: '#2878B5', accent: '#F2B544', background: '#EAECEF', surface: '#FFFFFF', text: '#17365D', mutedText: '#5B6673', border: '#D8DEE5', success: '#1F9D55', warning: '#D97706', danger: '#DC2626' };
const PAL_EVENTO: Record<string, string> = { primary: '#1E3A8A', secondary: '#2563EB', accent: '#22C55E', background: '#EEF2FF', surface: '#FFFFFF', text: '#1E293B', mutedText: '#64748B', border: '#DBEAFE', success: '#16A34A', warning: '#D97706', danger: '#DC2626' };
const PAL_SAUDE: Record<string, string> = { primary: '#0F766E', secondary: '#14B8A6', accent: '#22C55E', background: '#ECFDF5', surface: '#FFFFFF', text: '#134E4A', mutedText: '#64748B', border: '#CCFBF1', success: '#16A34A', warning: '#D97706', danger: '#DC2626' };
const PAL_OBRAS: Record<string, string> = { primary: '#9A3412', secondary: '#EA580C', accent: '#FACC15', background: '#FFF7ED', surface: '#FFFFFF', text: '#7C2D12', mutedText: '#78716C', border: '#FED7AA', success: '#16A34A', warning: '#D97706', danger: '#DC2626' };
const PAL_SERVICOS: Record<string, string> = { primary: '#3730A3', secondary: '#6366F1', accent: '#06B6D4', background: '#EEF2FF', surface: '#FFFFFF', text: '#312E81', mutedText: '#64748B', border: '#E0E7FF', success: '#16A34A', warning: '#D97706', danger: '#DC2626' };

export const TEMAS_CATALOGO: TemaModelo[] = [
  { chave: 'alerta', nome: 'Alerta e Aviso', categoria: 'Alertas e avisos', etiqueta: 'AVISO', descricao: 'Comunicação rápida de alerta, prazo, interrupção ou alteração de serviço.', paleta: PAL_ALERTA, alerta: true },
  { chave: 'evento', nome: 'Convite de Evento', categoria: 'Eventos e campanhas', etiqueta: 'EVENTO', descricao: 'Convite para palestras, eventos públicos, campanhas e ações.', paleta: PAL_EVENTO, carrossel: true },
  { chave: 'saude', nome: 'Ação de Saúde', categoria: 'Saúde e educação', etiqueta: 'SAÚDE', descricao: 'Vacinação, atendimento, comunicados e ações educativas.', paleta: PAL_SAUDE },
  { chave: 'obras', nome: 'Obra e Serviço', categoria: 'Obras e agricultura', etiqueta: 'OBRAS', descricao: 'Cascalhamento, estradas, pontes, equipamentos e resultados de serviços.', paleta: PAL_OBRAS },
  { chave: 'servicos', nome: 'Regularização e Serviço', categoria: 'Regularização e serviços públicos', etiqueta: 'SERVIÇOS', descricao: 'Documentação, inscrições, atendimentos e cronogramas.', paleta: PAL_SERVICOS },
];

const CAMPOS_PADRAO: Campo[] = [
  { chave: 'titulo', rotulo: 'Título', tipo: 'texto', obrigatorio: true, maxCaracteres: 70 },
  { chave: 'subtitulo', rotulo: 'Subtítulo', tipo: 'texto', obrigatorio: false, maxCaracteres: 90 },
  { chave: 'descricao', rotulo: 'Descrição', tipo: 'textarea', obrigatorio: false, maxCaracteres: 400 },
  { chave: 'data', rotulo: 'Data', tipo: 'texto', obrigatorio: false, fatoSensivel: true },
  { chave: 'horario', rotulo: 'Horário', tipo: 'texto', obrigatorio: false, fatoSensivel: true },
  { chave: 'local', rotulo: 'Local', tipo: 'texto', obrigatorio: false, fatoSensivel: true },
  { chave: 'instrucoes', rotulo: 'Instruções', tipo: 'textarea', obrigatorio: false, maxCaracteres: 300 },
  { chave: 'assinatura', rotulo: 'Assinatura institucional', tipo: 'texto', obrigatorio: false, maxCaracteres: 80 },
];

// ── Camada Visual + Estrutural ──────────────────────────────────────────────

function faixas(w: number, h: number, bandH: number): Elemento[] {
  const cx = w / 2;
  return [
    { id: 'faixa-topo', tipo: 'retangulo', x: 0, y: 0, w, h: bandH, fill: 'primary', camada: 1, bloqueado: true },
    { id: 'faixa-topo-acento', tipo: 'retangulo', x: Math.round(cx - w * 0.09), y: 0, w: Math.round(w * 0.18), h: bandH, fill: 'accent', camada: 2, bloqueado: true },
    { id: 'faixa-base', tipo: 'retangulo', x: 0, y: h - bandH, w, h: bandH, fill: 'primary', camada: 1, bloqueado: true },
    { id: 'faixa-base-acento', tipo: 'retangulo', x: Math.round(cx - w * 0.09), y: h - bandH, w: Math.round(w * 0.18), h: bandH, fill: 'accent', camada: 2, bloqueado: true },
  ];
}

/** Texto centralizado numa faixa/área. */
function txt(id: string, x: number, y: number, w: number, valor: string, variavel: string | undefined, over: Partial<EstiloTexto>, extra: Partial<Elemento> = {}): Elemento {
  return { id, tipo: 'texto', x, y, w, valor, variavel, camada: 6, ...(variavel ? { editavel: true } : { fixo: true }), estilo: est(over), ...extra } as Elemento;
}

/** Layout de alerta/aviso (card com destaque de alerta). */
function layoutAviso(w: number, h: number, tema: TemaModelo): Elemento[] {
  const cardX = Math.round(w * 0.065), cardW = Math.round(w * 0.87);
  const cardY = Math.round(h * 0.09), cardH = Math.round(h * 0.84);
  const bandH = Math.round(h * 0.028);
  const cx = w / 2;
  const els: Elemento[] = [...faixas(w, h, bandH)];
  els.push({ id: 'card', tipo: 'retangulo', x: cardX, y: cardY, w: cardW, h: cardH, fill: 'surface', raio: 44, camada: 3 });
  const alertR = Math.round(w * 0.078);
  const alertCy = cardY + Math.round(cardH * 0.01);
  els.push({ id: 'alerta', tipo: 'circulo', cx: Math.round(cx), cy: alertCy, r: alertR, fill: 'accent', camada: 5, bloqueado: true });
  els.push(txt('alerta-simbolo', Math.round(cx - 120), alertCy - Math.round(alertR * 0.62), 240, '!', undefined, { tamanho: Math.round(alertR * 1.5), cor: 'surface', peso: 900, limiteLinhas: 1 }));
  els.push(txt('cabecalho', cardX, cardY + Math.round(cardH * 0.14), cardW, 'COMUNICADO', undefined, { tamanho: 104, peso: 800, cor: 'primary', limiteLinhas: 1, espacamentoLetras: 1 }));
  const bannerY = cardY + Math.round(cardH * 0.23);
  els.push({ id: 'banner', tipo: 'retangulo', x: cardX + 30, y: bannerY, w: cardW - 60, h: 46, fill: 'accent', camada: 6, bloqueado: true });
  els.push(txt('banner-texto', cardX + 30, bannerY + 9, cardW - 60, 'ATENÇÃO  -  ATENÇÃO  -  ATENÇÃO  -  ATENÇÃO', undefined, { tamanho: 26, peso: 700, cor: 'primary', limiteLinhas: 1 }));
  els.push(txt('titulo', cardX + 20, cardY + Math.round(cardH * 0.30), cardW - 40, '{{titulo}}', 'titulo', { tamanho: 50, peso: 800, cor: 'primary', limiteLinhas: 3 }));
  els.push(txt('subtitulo', cardX + 20, cardY + Math.round(cardH * 0.42), cardW - 40, '{{subtitulo}}', 'subtitulo', { tamanho: 34, peso: 700, cor: 'secondary', limiteLinhas: 2 }));
  const perY = cardY + Math.round(cardH * 0.52), perH = Math.round(h * 0.075);
  const perX = cardX + 60, perW = cardW - 120;
  els.push({ id: 'periodo', tipo: 'retangulo', x: perX, y: perY, w: perW, h: perH, fill: 'accent', raio: Math.round(perH / 2), camada: 6, bloqueado: true });
  els.push(txt('periodo-texto', perX, perY + Math.round(perH * 0.28), perW, '{{data}}   {{horario}}', 'data', { tamanho: 46, peso: 800, cor: 'primary', limiteLinhas: 1 }));
  els.push(txt('descricao', cardX + 20, cardY + Math.round(cardH * 0.64), cardW - 40, '{{descricao}}', 'descricao', { tamanho: 34, peso: 600, cor: 'secondary', limiteLinhas: 3 }));
  els.push(txt('local', cardX + 20, cardY + Math.round(cardH * 0.75), cardW - 40, 'Local: {{local}}', 'local', { tamanho: 32, peso: 700, cor: 'primary', limiteLinhas: 2 }));
  els.push(txt('instrucoes', cardX + 20, cardY + Math.round(cardH * 0.83), cardW - 40, '{{instrucoes}}', 'instrucoes', { tamanho: 30, peso: 600, cor: 'mutedText', limiteLinhas: 3 }));
  els.push(txt('assinatura', cardX + 20, cardY + Math.round(cardH * 0.95), cardW - 40, '{{assinatura}}', 'assinatura', { tamanho: 30, peso: 700, cor: 'text', limiteLinhas: 1 }));
  els.push(txt('rodape', Math.round(w * 0.2), h - bandH + Math.round(bandH * 0.18), Math.round(w * 0.6), 'PREFEITURA MUNICIPAL', undefined, { tamanho: 26, peso: 800, cor: 'surface', limiteLinhas: 1 }));
  return els;
}

/** Layout de cabeçalho (faixa superior colorida + corpo). */
function layoutCabecalho(w: number, h: number, tema: TemaModelo): Elemento[] {
  const bandH = Math.round(h * 0.028);
  const m = Math.round(w * 0.083);
  const headerH = Math.round(h * 0.20);
  const els: Elemento[] = [];
  els.push({ id: 'cabecalho', tipo: 'retangulo', x: 0, y: 0, w, h: headerH, fill: 'primary', camada: 1, bloqueado: true });
  els.push({ id: 'cabecalho-acento', tipo: 'retangulo', x: 0, y: headerH, w, h: 12, fill: 'accent', camada: 2, bloqueado: true });
  els.push({ id: 'etiqueta', tipo: 'retangulo', x: m, y: Math.round(h * 0.035), w: Math.round(w * 0.26), h: Math.round(h * 0.032), fill: 'accent', raio: Math.round(h * 0.016), camada: 5, bloqueado: true });
  els.push(txt('etiqueta-texto', m, Math.round(h * 0.041), Math.round(w * 0.26), tema.etiqueta, undefined, { tamanho: 26, peso: 800, cor: 'primary', limiteLinhas: 1, alinhamento: 'center' }));
  els.push(txt('titulo', m, Math.round(h * 0.085), w - 2 * m, '{{titulo}}', 'titulo', { tamanho: 62, peso: 800, cor: 'surface', alinhamento: 'left', limiteLinhas: 2 }));
  els.push(txt('subtitulo', m, headerH + Math.round(h * 0.02), w - 2 * m, '{{subtitulo}}', 'subtitulo', { tamanho: 34, peso: 700, cor: 'secondary', alinhamento: 'left', limiteLinhas: 2 }));
  const pillY = headerH + Math.round(h * 0.09), pillH = Math.round(h * 0.062);
  els.push({ id: 'periodo', tipo: 'retangulo', x: m, y: pillY, w: w - 2 * m, h: pillH, fill: 'accent', raio: Math.round(pillH / 2), camada: 3, bloqueado: true });
  els.push(txt('periodo-texto', m, pillY + Math.round(pillH * 0.24), w - 2 * m, '{{data}}   ·   {{horario}}', 'data', { tamanho: 34, peso: 800, cor: 'primary', limiteLinhas: 1 }));
  els.push(txt('descricao', m, headerH + Math.round(h * 0.20), w - 2 * m, '{{descricao}}', 'descricao', { tamanho: 36, peso: 600, cor: 'text', limiteLinhas: 5 }));
  els.push(txt('local', m, headerH + Math.round(h * 0.45), w - 2 * m, 'Local: {{local}}', 'local', { tamanho: 32, peso: 700, cor: 'primary', limiteLinhas: 2 }));
  els.push(txt('instrucoes', m, headerH + Math.round(h * 0.53), w - 2 * m, '{{instrucoes}}', 'instrucoes', { tamanho: 30, peso: 600, cor: 'mutedText', limiteLinhas: 3 }));
  els.push(txt('assinatura', m, Math.round(h * 0.90), w - 2 * m, '{{assinatura}}', 'assinatura', { tamanho: 30, peso: 700, cor: 'text', limiteLinhas: 1 }));
  els.push({ id: 'faixa-base', tipo: 'retangulo', x: 0, y: h - bandH, w, h: bandH, fill: 'primary', camada: 1, bloqueado: true });
  els.push({ id: 'faixa-base-acento', tipo: 'retangulo', x: Math.round(w / 2 - w * 0.09), y: h - bandH, w: Math.round(w * 0.18), h: bandH, fill: 'accent', camada: 2, bloqueado: true });
  els.push(txt('rodape', Math.round(w * 0.2), h - bandH + Math.round(bandH * 0.18), Math.round(w * 0.6), 'PREFEITURA MUNICIPAL', undefined, { tamanho: 24, peso: 800, cor: 'surface', limiteLinhas: 1 }));
  return els;
}

function elementosDoTema(w: number, h: number, tema: TemaModelo): Elemento[] {
  return tema.alerta ? layoutAviso(w, h, tema) : layoutCabecalho(w, h, tema);
}

// ── Seed ────────────────────────────────────────────────────────────────────

async function garantirPaleta(tema: TemaModelo): Promise<any> {
  const slug = `familia-${tema.chave}`;
  const [p] = await ArtePaleta.findOrCreate({
    where: { slug, municipio_id: null },
    defaults: { municipio_id: null, nome: tema.categoria, slug, descricao: `Paleta da família ${tema.categoria}.`, cores: JSON.stringify(tema.paleta), tematica: true, estado: 'publicado' } as any,
  });
  await p.update({ cores: JSON.stringify(tema.paleta) });
  return p;
}

async function garantirModelo(mun: any, tema: TemaModelo, paleta: any): Promise<void> {
  const slug = `familia-${tema.chave}-${mun.id}`;
  const existente = await ArteTemplate.findOne({ where: { municipio_id: mun.id, slug } });
  if (existente) return;

  const tpl = await ArteTemplate.create({
    municipio_id: mun.id,
    nome: tema.nome,
    slug,
    descricao: tema.descricao,
    categoria: tema.categoria,
    estado: 'publicado',
    versao: 1,
    paleta_id: paleta.id,
    formatos: JSON.stringify(['9:16', '3:4']),
    campos: JSON.stringify(CAMPOS_PADRAO),
    carrossel: !!tema.carrossel,
    autor_id: null,
  } as any);

  const variantes: any[] = [
    { template_id: tpl.id, chave: '9:16', papel: 'principal', nome: 'Vertical 9:16', largura: 1080, altura: 1920, config: JSON.stringify({ elementos: elementosDoTema(1080, 1920, tema) }) },
    { template_id: tpl.id, chave: '3:4', papel: 'principal', nome: 'Retrato 3:4', largura: 1080, altura: 1440, config: JSON.stringify({ elementos: elementosDoTema(1080, 1440, tema) }) },
  ];
  if (tema.carrossel) {
    variantes.push({ template_id: tpl.id, chave: 'capa', papel: 'capa', nome: 'Capa do carrossel', largura: 1080, altura: 1440, config: JSON.stringify({ elementos: elementosDoTema(1080, 1440, tema) }) });
    variantes.push({ template_id: tpl.id, chave: 'interna', papel: 'interna', nome: 'Página interna', largura: 1080, altura: 1440, config: JSON.stringify({ elementos: tema.alerta ? layoutAviso(1080, 1440, tema) : layoutCabecalho(1080, 1440, tema) }) });
  }
  await ArteTemplateVariante.bulkCreate(variantes as any);
}

export async function seedArtes(): Promise<void> {
  // Paleta padrão (fallback do editor) + estilos tipográficos
  let paletaBase = await ArtePaleta.findOne({ where: { slug: 'padrao', municipio_id: null } });
  if (!paletaBase) {
    paletaBase = await ArtePaleta.create({
      municipio_id: null, nome: 'Paleta institucional padrão', slug: 'padrao',
      descricao: 'Paleta ilustrativa com funções semânticas.', cores: JSON.stringify(PALETA_PADRAO), tematica: false, estado: 'publicado',
    } as any);
  }

  if ((await ArteEstilo.count()) === 0) {
    await ArteEstilo.bulkCreate([
      { municipio_id: null, nome: 'Título principal', familia: FAM, peso: 800, tamanho: 88, tamanho_min: 44, altura_linha: 1.08, alinhamento: 'left', cor: 'text', limite_linhas: 3, overflow: 'diminuir' },
      { municipio_id: null, nome: 'Subtítulo', familia: FAM, peso: 600, tamanho: 52, tamanho_min: 30, altura_linha: 1.2, alinhamento: 'left', cor: 'secondary', limite_linhas: 2, overflow: 'diminuir' },
      { municipio_id: null, nome: 'Texto informativo', familia: FAM, peso: 400, tamanho: 40, tamanho_min: 26, altura_linha: 1.35, alinhamento: 'left', cor: 'text', limite_linhas: 6, overflow: 'diminuir' },
      { municipio_id: null, nome: 'Data e horário', familia: FAM, peso: 700, tamanho: 46, tamanho_min: 28, altura_linha: 1.2, alinhamento: 'left', cor: 'accent', limite_linhas: 2, overflow: 'diminuir' },
      { municipio_id: null, nome: 'Rodapé', familia: FAM, peso: 500, tamanho: 30, tamanho_min: 20, altura_linha: 1.25, alinhamento: 'left', cor: 'surface', limite_linhas: 2, overflow: 'diminuir' },
    ] as any);
  }

  // Catálogo de 5 famílias por município
  const paletas: Record<string, any> = {};
  for (const tema of TEMAS_CATALOGO) paletas[tema.chave] = await garantirPaleta(tema);

  const municipios = await Municipio.findAll({ where: { ativo: true } });
  for (const mun of municipios as any[]) {
    for (const tema of TEMAS_CATALOGO) await garantirModelo(mun, tema, paletas[tema.chave]);
  }
}
