/**
 * Dados padrão do gerador de artes: paleta ilustrativa, estilos tipográficos
 * e um modelo inicial determinístico (9:16 e 3:4) para o município.
 */

import { ArtePaleta, ArteEstilo, ArteTemplate, ArteTemplateVariante, Municipio } from '../../database/models/index.ts';
import { PALETA_PADRAO } from './paletas.ts';
import type { Elemento } from './types.ts';

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
      { municipio_id: null, nome: 'Título principal', familia: 'Inter, system-ui, sans-serif', peso: 800, tamanho: 88, tamanho_min: 44, altura_linha: 1.08, alinhamento: 'left', cor: 'text', limite_linhas: 3, overflow: 'diminuir' },
      { municipio_id: null, nome: 'Subtítulo', familia: 'Inter, system-ui, sans-serif', peso: 600, tamanho: 52, tamanho_min: 30, altura_linha: 1.2, alinhamento: 'left', cor: 'secondary', limite_linhas: 2, overflow: 'diminuir' },
      { municipio_id: null, nome: 'Texto informativo', familia: 'Inter, system-ui, sans-serif', peso: 400, tamanho: 40, tamanho_min: 26, altura_linha: 1.35, alinhamento: 'left', cor: 'text', limite_linhas: 6, overflow: 'diminuir' },
      { municipio_id: null, nome: 'Data e horário', familia: 'Inter, system-ui, sans-serif', peso: 700, tamanho: 46, tamanho_min: 28, altura_linha: 1.2, alinhamento: 'left', cor: 'accent', limite_linhas: 2, overflow: 'diminuir' },
      { municipio_id: null, nome: 'Rodapé', familia: 'Inter, system-ui, sans-serif', peso: 500, tamanho: 30, tamanho_min: 20, altura_linha: 1.25, alinhamento: 'left', cor: 'surface', limite_linhas: 2, overflow: 'diminuir' },
    ] as any);
  }

  // ── Modelo inicial por município ──────────────────────────────────────────
  const municipios = await Municipio.findAll({ where: { ativo: true } });
  for (const mun of municipios as any[]) {
    const existente = await ArteTemplate.findOne({ where: { municipio_id: mun.id } });
    if (existente) continue;

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
      {
        template_id: tpl.id, chave: '9:16', papel: 'principal', nome: 'Vertical 9:16',
        largura: 1080, altura: 1920, config: JSON.stringify({ elementos: elementosVerticais(1080, 1920) }),
      },
      {
        template_id: tpl.id, chave: '3:4', papel: 'principal', nome: 'Retrato 3:4',
        largura: 1080, altura: 1440, config: JSON.stringify({ elementos: elementosVerticais(1080, 1440) }),
      },
      {
        template_id: tpl.id, chave: 'capa', papel: 'capa', nome: 'Capa do carrossel',
        largura: 1080, altura: 1440, config: JSON.stringify({ elementos: elementosVerticais(1080, 1440) }),
      },
      {
        template_id: tpl.id, chave: 'interna', papel: 'interna', nome: 'Página interna',
        largura: 1080, altura: 1440, config: JSON.stringify({ elementos: elementosInterno(1080, 1440) }),
      },
    ] as any);
  }
}

function elementosVerticais(w: number, h: number): Elemento[] {
  const m = Math.round(w * 0.083);
  return [
    { id: 'fundo-faixa', tipo: 'retangulo', x: 0, y: 0, w, h: Math.round(h * 0.18), fill: 'primary', camada: 1, bloqueado: true },
    { id: 'faixa-acento', tipo: 'retangulo', x: 0, y: Math.round(h * 0.18), w, h: 12, fill: 'accent', camada: 2, bloqueado: true },
    { id: 'titulo', tipo: 'texto', x: m, y: Math.round(h * 0.24), w: w - 2 * m, valor: '{{titulo}}', variavel: 'titulo', camada: 3, editavel: true, estilo: { familia: 'Inter, system-ui, sans-serif', peso: 800, tamanho: 92, tamanhoMin: 44, alturaLinha: 1.08, alinhamento: 'left', cor: 'text', limiteLinhas: 3, margem: 0, overflow: 'diminuir', espacamentoLetras: 0 } },
    { id: 'subtitulo', tipo: 'texto', x: m, y: Math.round(h * 0.42), w: w - 2 * m, valor: '{{subtitulo}}', variavel: 'subtitulo', camada: 3, editavel: true, estilo: { familia: 'Inter, system-ui, sans-serif', peso: 600, tamanho: 52, tamanhoMin: 30, alturaLinha: 1.2, alinhamento: 'left', cor: 'secondary', limiteLinhas: 2, margem: 0, overflow: 'diminuir', espacamentoLetras: 0 } },
    { id: 'texto', tipo: 'texto', x: m, y: Math.round(h * 0.5), w: w - 2 * m, valor: '{{texto}}', variavel: 'texto', camada: 3, editavel: true, estilo: { familia: 'Inter, system-ui, sans-serif', peso: 400, tamanho: 40, tamanhoMin: 26, alturaLinha: 1.35, alinhamento: 'left', cor: 'text', limiteLinhas: 8, margem: 0, overflow: 'diminuir', espacamentoLetras: 0 } },
    { id: 'data', tipo: 'texto', x: m, y: Math.round(h * 0.82), w: w - 2 * m, valor: '{{data}}  {{horario}}', variavel: 'data', camada: 3, editavel: true, estilo: { familia: 'Inter, system-ui, sans-serif', peso: 700, tamanho: 46, tamanhoMin: 28, alturaLinha: 1.2, alinhamento: 'left', cor: 'accent', limiteLinhas: 2, margem: 0, overflow: 'diminuir', espacamentoLetras: 0 } },
    { id: 'rodape', tipo: 'retangulo', x: 0, y: Math.round(h * 0.9), w, h: Math.round(h * 0.1), fill: 'primary', camada: 1, bloqueado: true },
    { id: 'rodape-texto', tipo: 'texto', x: m, y: Math.round(h * 0.93), w: w - 2 * m, valor: 'Prefeitura Municipal', camada: 3, fixo: true, estilo: { familia: 'Inter, system-ui, sans-serif', peso: 500, tamanho: 30, tamanhoMin: 24, alturaLinha: 1.25, alinhamento: 'left', cor: 'surface', limiteLinhas: 2, margem: 0, overflow: 'diminuir', espacamentoLetras: 0 } },
  ];
}

function elementosInterno(w: number, h: number): Elemento[] {
  const m = Math.round(w * 0.083);
  return [
    { id: 'faixa-topo', tipo: 'retangulo', x: 0, y: 0, w, h: 18, fill: 'accent', camada: 1, bloqueado: true },
    { id: 'titulo', tipo: 'texto', x: m, y: Math.round(h * 0.1), w: w - 2 * m, valor: '{{titulo}}', variavel: 'titulo', camada: 3, editavel: true, estilo: { familia: 'Inter, system-ui, sans-serif', peso: 700, tamanho: 68, tamanhoMin: 40, alturaLinha: 1.12, alinhamento: 'left', cor: 'primary', limiteLinhas: 3, margem: 0, overflow: 'diminuir', espacamentoLetras: 0 } },
    { id: 'texto', tipo: 'texto', x: m, y: Math.round(h * 0.34), w: w - 2 * m, valor: '{{texto}}', variavel: 'texto', camada: 3, editavel: true, estilo: { familia: 'Inter, system-ui, sans-serif', peso: 400, tamanho: 44, tamanhoMin: 28, alturaLinha: 1.4, alinhamento: 'left', cor: 'text', limiteLinhas: 10, margem: 0, overflow: 'diminuir', espacamentoLetras: 0 } },
  ];
}
