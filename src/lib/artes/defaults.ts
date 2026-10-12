/**
 * Dados padrão do gerador de artes: paleta ilustrativa, estilos tipográficos
 * e um modelo inicial determinístico (9:16 e 3:4) para o município.
 */

import { ArtePaleta, ArteEstilo, ArteTemplate, ArteTemplateVariante, Municipio } from '../../database/models/index.ts';
import { PALETA_PADRAO } from './paletas.ts';
import type { Elemento, EstiloTexto } from './types.ts';

export async function seedArtes(): Promise<void> {
  // ── Paleta padrão ─────────────────────────────────────────────────────────
  let paleta = await ArtePaleta.findOne({ where: { slug: 'padrao', municipio_id: null } });
  if (!paleta) {
    paleta = await ArtePaleta.create({
      municipio_id: null,
      nome: 'Paleta institucional padrão',
      slug: 'padrao',
      descricao: 'Paleta ilustrativa com funções semânticas. Ajuste conforme a identidade do município.',
      cores: JSON.stringify(PALETA_PADRAO),
      tematica: false,
      estado: 'publicado',
    } as any);
  }

  // ── Estilos tipográficos padrão ───────────────────────────────────────────
  if ((await ArteEstilo.count()) === 0) {
    await ArteEstilo.bulkCreate([
      { municipio_id: null, nome: 'Título principal', familia: 'Arial, "Helvetica Neue", Helvetica, sans-serif', peso: 800, tamanho: 88, tamanho_min: 44, altura_linha: 1.08, alinhamento: 'left', cor: 'text', limite_linhas: 3, overflow: 'diminuir' },
      { municipio_id: null, nome: 'Subtítulo', familia: 'Arial, "Helvetica Neue", Helvetica, sans-serif', peso: 600, tamanho: 52, tamanho_min: 30, altura_linha: 1.2, alinhamento: 'left', cor: 'secondary', limite_linhas: 2, overflow: 'diminuir' },
      { municipio_id: null, nome: 'Texto informativo', familia: 'Arial, "Helvetica Neue", Helvetica, sans-serif', peso: 400, tamanho: 40, tamanho_min: 26, altura_linha: 1.35, alinhamento: 'left', cor: 'text', limite_linhas: 6, overflow: 'diminuir' },
      { municipio_id: null, nome: 'Data e horário', familia: 'Arial, "Helvetica Neue", Helvetica, sans-serif', peso: 700, tamanho: 46, tamanho_min: 28, altura_linha: 1.2, alinhamento: 'left', cor: 'accent', limite_linhas: 2, overflow: 'diminuir' },
      { municipio_id: null, nome: 'Rodapé', familia: 'Arial, "Helvetica Neue", Helvetica, sans-serif', peso: 500, tamanho: 30, tamanho_min: 20, altura_linha: 1.25, alinhamento: 'left', cor: 'surface', limite_linhas: 2, overflow: 'diminuir' },
    ] as any);
  }

  // ── Modelos iniciais por município ────────────────────────────────────────
  const paletaAviso = await garantirPaletaAviso();
  const municipios = await Municipio.findAll({ where: { ativo: true } });
  for (const mun of municipios as any[]) {
    await garantirTemplatePadrao(mun, paleta);
    await garantirTemplateAviso(mun, paletaAviso);
  }
}

async function garantirPaletaAviso(): Promise<any> {
  const CORES = {
    primary: '#1D4ED8', secondary: '#2563EB', accent: '#FFD400',
    background: '#EAECEF', surface: '#FFFFFF', text: '#1D4ED8',
    mutedText: '#64748B', border: '#E5E7EB', success: '#1F9D55', warning: '#D97706', danger: '#DC2626',
  };
  const [p] = await ArtePaleta.findOrCreate({
    where: { slug: 'comunicado', municipio_id: null },
    defaults: {
      municipio_id: null, nome: 'Comunicado (azul/amarelo)', slug: 'comunicado',
      descricao: 'Paleta do modelo de aviso/comunicado.', cores: JSON.stringify(CORES), tematica: true, estado: 'publicado',
    } as any,
  });
  return p;
}

async function garantirTemplatePadrao(mun: any, paleta: any): Promise<void> {
  const existente = await ArteTemplate.findOne({ where: { municipio_id: mun.id, slug: `comunicado-padrao-${mun.id}` } });
  if (existente) return;

  const tpl = await ArteTemplate.create({
    municipio_id: mun.id,
    nome: 'Comunicado padrão',
    slug: `comunicado-padrao-${mun.id}`,
    descricao: 'Modelo inicial vertical com cabeçalho, título, texto e faixa de rodapé.',
    categoria: 'Comunicados',
    estado: 'publicado',
    versao: 1,
    paleta_id: paleta.id,
    formatos: JSON.stringify(['9:16', '3:4']),
    campos: JSON.stringify([
      { chave: 'titulo', rotulo: 'Título', tipo: 'texto', obrigatorio: true, maxCaracteres: 80 },
      { chave: 'subtitulo', rotulo: 'Subtítulo', tipo: 'texto', obrigatorio: false, maxCaracteres: 120 },
      { chave: 'texto', rotulo: 'Texto', tipo: 'textarea', obrigatorio: true, maxCaracteres: 400 },
      { chave: 'data', rotulo: 'Data', tipo: 'data', obrigatorio: false, fatoSensivel: true },
      { chave: 'horario', rotulo: 'Horário', tipo: 'hora', obrigatorio: false, fatoSensivel: true },
      { chave: 'local', rotulo: 'Local', tipo: 'texto', obrigatorio: false, fatoSensivel: true },
    ]),
    carrossel: true,
    autor_id: null,
  } as any);

  await ArteTemplateVariante.bulkCreate([
    { template_id: tpl.id, chave: '9:16', papel: 'principal', nome: 'Vertical 9:16', largura: 1080, altura: 1920, config: JSON.stringify({ elementos: elementosVerticais(1080, 1920) }) },
    { template_id: tpl.id, chave: '3:4', papel: 'principal', nome: 'Retrato 3:4', largura: 1080, altura: 1440, config: JSON.stringify({ elementos: elementosVerticais(1080, 1440) }) },
    { template_id: tpl.id, chave: 'capa', papel: 'capa', nome: 'Capa do carrossel', largura: 1080, altura: 1440, config: JSON.stringify({ elementos: elementosVerticais(1080, 1440) }) },
    { template_id: tpl.id, chave: 'interna', papel: 'interna', nome: 'Página interna', largura: 1080, altura: 1440, config: JSON.stringify({ elementos: elementosInterno(1080, 1440) }) },
  ] as any);
}

async function garantirTemplateAviso(mun: any, paleta: any): Promise<void> {
  const existente = await ArteTemplate.findOne({ where: { municipio_id: mun.id, slug: 'aviso-comunicado' } });
  if (existente) return;

  const tpl = await ArteTemplate.create({
    municipio_id: mun.id,
    nome: 'Comunicado / Aviso',
    slug: 'aviso-comunicado',
    descricao: 'Modelo de comunicado/aviso institucional com alerta, faixa de atenção e período destacado.',
    categoria: 'Comunicados',
    estado: 'publicado',
    versao: 1,
    paleta_id: paleta.id,
    formatos: JSON.stringify(['9:16', '3:4']),
    campos: JSON.stringify([
      { chave: 'titulo', rotulo: 'Título', tipo: 'texto', obrigatorio: true, maxCaracteres: 70 },
      { chave: 'chamada', rotulo: 'Chamada', tipo: 'texto', obrigatorio: false, maxCaracteres: 80 },
      { chave: 'periodo_label', rotulo: 'Período (rótulo)', tipo: 'texto', obrigatorio: false, maxCaracteres: 40 },
      { chave: 'periodo_valor', rotulo: 'Período (datas)', tipo: 'texto', obrigatorio: false, maxCaracteres: 60, fatoSensivel: true },
      { chave: 'destaque', rotulo: 'Destaque', tipo: 'texto', obrigatorio: false, maxCaracteres: 120 },
      { chave: 'texto', rotulo: 'Texto', tipo: 'textarea', obrigatorio: false, maxCaracteres: 400 },
      { chave: 'despedida', rotulo: 'Despedida', tipo: 'texto', obrigatorio: false, maxCaracteres: 120 },
    ]),
    carrossel: false,
    autor_id: null,
  } as any);

  await ArteTemplateVariante.bulkCreate([
    { template_id: tpl.id, chave: '9:16', papel: 'principal', nome: 'Vertical 9:16', largura: 1080, altura: 1920, config: JSON.stringify({ elementos: elementosAviso(1080, 1920) }) },
    { template_id: tpl.id, chave: '3:4', papel: 'principal', nome: 'Retrato 3:4', largura: 1080, altura: 1440, config: JSON.stringify({ elementos: elementosAviso(1080, 1440) }) },
  ] as any);
}

function elementosAviso(w: number, h: number): Elemento[] {
  const fam = 'Arial, Helvetica, sans-serif';
  const est = (over: Partial<EstiloTexto> = {}): Partial<EstiloTexto> => ({
    familia: fam, peso: 700, tamanho: 40, tamanhoMin: 24, alturaLinha: 1.2, espacamentoLetras: 0,
    alinhamento: 'center', cor: 'primary', limiteLinhas: null, margem: 0, overflow: 'diminuir', ...over,
  });
  const cardX = Math.round(w * 0.065), cardW = Math.round(w * 0.87);
  const cardY = Math.round(h * 0.09), cardH = Math.round(h * 0.84);
  const bandH = Math.round(h * 0.028);
  const cx = w / 2;
  const els: Elemento[] = [];

  els.push({ id: 'faixa-topo', tipo: 'retangulo', x: 0, y: 0, w, h: bandH, fill: 'primary', camada: 1, bloqueado: true });
  els.push({ id: 'faixa-topo-acento', tipo: 'retangulo', x: Math.round(cx - w * 0.09), y: 0, w: Math.round(w * 0.18), h: bandH, fill: 'accent', camada: 2, bloqueado: true });
  els.push({ id: 'faixa-base', tipo: 'retangulo', x: 0, y: h - bandH, w, h: bandH, fill: 'primary', camada: 1, bloqueado: true });
  els.push({ id: 'faixa-base-acento', tipo: 'retangulo', x: Math.round(cx - w * 0.09), y: h - bandH, w: Math.round(w * 0.18), h: bandH, fill: 'accent', camada: 2, bloqueado: true });
  els.push({ id: 'card', tipo: 'retangulo', x: cardX, y: cardY, w: cardW, h: cardH, fill: 'surface', raio: 44, camada: 3 });

  const pillY = cardY + Math.round(cardH * 0.028);
  els.push({ id: 'pill-a', tipo: 'retangulo', x: cardX + 40, y: pillY, w: 74, h: 22, fill: 'primary', raio: 11, camada: 4, bloqueado: true });
  els.push({ id: 'pill-b', tipo: 'retangulo', x: cardX + 126, y: pillY, w: 74, h: 22, fill: 'secondary', opacidade: 0.8, raio: 11, camada: 4, bloqueado: true });
  els.push({ id: 'pill-c', tipo: 'retangulo', x: cardX + 212, y: pillY, w: 74, h: 22, fill: 'secondary', opacidade: 0.45, raio: 11, camada: 4, bloqueado: true });

  const alertR = Math.round(w * 0.078);
  const alertCy = cardY + Math.round(cardH * 0.01);
  els.push({ id: 'alerta', tipo: 'circulo', cx: Math.round(cx), cy: alertCy, r: alertR, fill: 'accent', camada: 5, bloqueado: true });
  els.push({ id: 'alerta-simbolo', tipo: 'texto', x: Math.round(cx - 120), y: alertCy - Math.round(alertR * 0.62), w: 240, valor: '!', camada: 6, bloqueado: true, estilo: est({ tamanho: Math.round(alertR * 1.5), cor: 'surface', peso: 900, limiteLinhas: 1, overflow: 'diminuir' }) });

  els.push({ id: 'cabecalho', tipo: 'texto', x: cardX, y: cardY + Math.round(cardH * 0.15), w: cardW, valor: 'COMUNICADO', camada: 6, fixo: true, estilo: est({ tamanho: 104, peso: 800, cor: 'primary', limiteLinhas: 1, espacamentoLetras: 1 }) });

  const bannerY = cardY + Math.round(cardH * 0.24);
  els.push({ id: 'banner', tipo: 'retangulo', x: cardX + 30, y: bannerY, w: cardW - 60, h: 46, fill: 'accent', camada: 6, bloqueado: true });
  els.push({ id: 'banner-texto', tipo: 'texto', x: cardX + 30, y: bannerY + 9, w: cardW - 60, valor: 'ATENÇÃO  -  ATENÇÃO  -  ATENÇÃO  -  ATENÇÃO', camada: 7, fixo: true, estilo: est({ tamanho: 26, peso: 700, cor: 'primary', limiteLinhas: 1 }) });

  els.push({ id: 'titulo', tipo: 'texto', x: cardX + 20, y: cardY + Math.round(cardH * 0.30), w: cardW - 40, valor: '{{titulo}}', variavel: 'titulo', camada: 6, editavel: true, estilo: est({ tamanho: 50, peso: 800, cor: 'primary', limiteLinhas: 3 }) });
  els.push({ id: 'chamada', tipo: 'texto', x: cardX + 20, y: cardY + Math.round(cardH * 0.52), w: cardW - 40, valor: '{{chamada}}', variavel: 'chamada', camada: 6, editavel: true, estilo: est({ tamanho: 34, peso: 700, cor: 'secondary', limiteLinhas: 2 }) });

  const perY = cardY + Math.round(cardH * 0.60);
  const perX = cardX + 60, perW = cardW - 120, perH = Math.round(h * 0.075);
  els.push({ id: 'periodo-pill', tipo: 'retangulo', x: perX, y: perY, w: perW, h: perH, fill: 'accent', raio: Math.round(perH / 2), camada: 6, bloqueado: true });
  els.push({ id: 'periodo-label', tipo: 'texto', x: perX, y: perY + 12, w: perW, valor: '{{periodo_label}}', variavel: 'periodo_label', camada: 7, editavel: true, estilo: est({ tamanho: 26, peso: 800, cor: 'primary', limiteLinhas: 1 }) });
  els.push({ id: 'periodo-valor', tipo: 'texto', x: perX, y: perY + Math.round(perH * 0.4), w: perW, valor: '{{periodo_valor}}', variavel: 'periodo_valor', camada: 7, editavel: true, estilo: est({ tamanho: 52, peso: 800, cor: 'primary', limiteLinhas: 1 }) });

  els.push({ id: 'destaque', tipo: 'texto', x: cardX + 20, y: cardY + Math.round(cardH * 0.71), w: cardW - 40, valor: '{{destaque}}', variavel: 'destaque', camada: 6, editavel: true, estilo: est({ tamanho: 38, peso: 800, cor: 'primary', limiteLinhas: 3 }) });
  els.push({ id: 'texto', tipo: 'texto', x: cardX + 20, y: cardY + Math.round(cardH * 0.84), w: cardW - 40, valor: '{{texto}}', variavel: 'texto', camada: 6, editavel: true, estilo: est({ tamanho: 34, peso: 600, cor: 'secondary', limiteLinhas: 5 }) });
  els.push({ id: 'despedida', tipo: 'texto', x: cardX + 20, y: cardY + Math.round(cardH * 0.96), w: cardW - 40, valor: '{{despedida}}', variavel: 'despedida', camada: 6, editavel: true, estilo: est({ tamanho: 34, peso: 700, cor: 'secondary', limiteLinhas: 2 }) });
  els.push({ id: 'rodape', tipo: 'texto', x: Math.round(w * 0.2), y: h - Math.round(h * 0.055), w: Math.round(w * 0.6), valor: 'PREFEITURA MUNICIPAL', camada: 6, fixo: true, estilo: est({ tamanho: 26, peso: 800, cor: 'primary', limiteLinhas: 1 }) });

  return els;
}

function elementosVerticais(w: number, h: number): Elemento[] {
  const m = Math.round(w * 0.083);
  return [
    { id: 'fundo-faixa', tipo: 'retangulo', x: 0, y: 0, w, h: Math.round(h * 0.18), fill: 'primary', camada: 1, bloqueado: true },
    { id: 'faixa-acento', tipo: 'retangulo', x: 0, y: Math.round(h * 0.18), w, h: 12, fill: 'accent', camada: 2, bloqueado: true },
    { id: 'titulo', tipo: 'texto', x: m, y: Math.round(h * 0.24), w: w - 2 * m, valor: '{{titulo}}', variavel: 'titulo', camada: 3, editavel: true, estilo: { familia: 'Arial, "Helvetica Neue", Helvetica, sans-serif', peso: 800, tamanho: 92, tamanhoMin: 44, alturaLinha: 1.08, alinhamento: 'left', cor: 'text', limiteLinhas: 3, margem: 0, overflow: 'diminuir', espacamentoLetras: 0 } },
    { id: 'subtitulo', tipo: 'texto', x: m, y: Math.round(h * 0.42), w: w - 2 * m, valor: '{{subtitulo}}', variavel: 'subtitulo', camada: 3, editavel: true, estilo: { familia: 'Arial, "Helvetica Neue", Helvetica, sans-serif', peso: 600, tamanho: 52, tamanhoMin: 30, alturaLinha: 1.2, alinhamento: 'left', cor: 'secondary', limiteLinhas: 2, margem: 0, overflow: 'diminuir', espacamentoLetras: 0 } },
    { id: 'texto', tipo: 'texto', x: m, y: Math.round(h * 0.5), w: w - 2 * m, valor: '{{texto}}', variavel: 'texto', camada: 3, editavel: true, estilo: { familia: 'Arial, "Helvetica Neue", Helvetica, sans-serif', peso: 400, tamanho: 40, tamanhoMin: 26, alturaLinha: 1.35, alinhamento: 'left', cor: 'text', limiteLinhas: 8, margem: 0, overflow: 'diminuir', espacamentoLetras: 0 } },
    { id: 'data', tipo: 'texto', x: m, y: Math.round(h * 0.82), w: w - 2 * m, valor: '{{data}}  {{horario}}', variavel: 'data', camada: 3, editavel: true, estilo: { familia: 'Arial, "Helvetica Neue", Helvetica, sans-serif', peso: 700, tamanho: 46, tamanhoMin: 28, alturaLinha: 1.2, alinhamento: 'left', cor: 'accent', limiteLinhas: 2, margem: 0, overflow: 'diminuir', espacamentoLetras: 0 } },
    { id: 'rodape', tipo: 'retangulo', x: 0, y: Math.round(h * 0.9), w, h: Math.round(h * 0.1), fill: 'primary', camada: 1, bloqueado: true },
    { id: 'rodape-texto', tipo: 'texto', x: m, y: Math.round(h * 0.93), w: w - 2 * m, valor: 'Prefeitura Municipal', camada: 3, fixo: true, estilo: { familia: 'Arial, "Helvetica Neue", Helvetica, sans-serif', peso: 500, tamanho: 30, tamanhoMin: 24, alturaLinha: 1.25, alinhamento: 'left', cor: 'surface', limiteLinhas: 2, margem: 0, overflow: 'diminuir', espacamentoLetras: 0 } },
  ];
}

function elementosInterno(w: number, h: number): Elemento[] {
  const m = Math.round(w * 0.083);
  return [
    { id: 'faixa-topo', tipo: 'retangulo', x: 0, y: 0, w, h: 18, fill: 'accent', camada: 1, bloqueado: true },
    { id: 'titulo', tipo: 'texto', x: m, y: Math.round(h * 0.1), w: w - 2 * m, valor: '{{titulo}}', variavel: 'titulo', camada: 3, editavel: true, estilo: { familia: 'Arial, "Helvetica Neue", Helvetica, sans-serif', peso: 700, tamanho: 68, tamanhoMin: 40, alturaLinha: 1.12, alinhamento: 'left', cor: 'primary', limiteLinhas: 3, margem: 0, overflow: 'diminuir', espacamentoLetras: 0 } },
    { id: 'texto', tipo: 'texto', x: m, y: Math.round(h * 0.34), w: w - 2 * m, valor: '{{texto}}', variavel: 'texto', camada: 3, editavel: true, estilo: { familia: 'Arial, "Helvetica Neue", Helvetica, sans-serif', peso: 400, tamanho: 44, tamanhoMin: 28, alturaLinha: 1.4, alinhamento: 'left', cor: 'text', limiteLinhas: 10, margem: 0, overflow: 'diminuir', espacamentoLetras: 0 } },
  ];
}
