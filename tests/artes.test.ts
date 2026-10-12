import { test } from 'node:test';
import assert from 'node:assert/strict';

import { quebrarLinhas, ajustarTexto } from '../src/lib/artes/texto.ts';
import { compor } from '../src/lib/artes/composicao.ts';
import { validarComposicao } from '../src/lib/artes/validacao.ts';
import { PALETA_PADRAO, razaoContraste, resolverCor, validarPaleta } from '../src/lib/artes/paletas.ts';
import { svgParaPng } from '../src/lib/artes/render.ts';
import type { Campo, EstiloTexto, Variante } from '../src/lib/artes/types.ts';

const estilo = (over: Partial<EstiloTexto> = {}): EstiloTexto => ({
  familia: 'Inter, sans-serif',
  peso: 700,
  tamanho: 64,
  tamanhoMin: 24,
  alturaLinha: 1.15,
  espacamentoLetras: 0,
  alinhamento: 'left',
  cor: 'text',
  limiteLinhas: null,
  margem: 0,
  overflow: 'avisar',
  ...over,
});

test('quebrarLinhas respeita quebras explícitas e largura', () => {
  const linhas = quebrarLinhas('Uma frase bem longa aqui\nOutra linha', 300, 40);
  assert.ok(linhas.includes('Outra linha'));
  assert.ok(linhas.length >= 2);
});

test('ajustarTexto reduz a fonte até o mínimo e sinaliza excesso', () => {
  const texto = 'palavra '.repeat(200);
  const r = ajustarTexto(texto, 400, 200, estilo({ tamanho: 80, tamanhoMin: 40 }));
  assert.equal(r.fontSize, 40);
  assert.equal(r.excedeu, true);
});

test('ajustarTexto corta e adiciona reticências quando overflow=cortar', () => {
  const r = ajustarTexto('a b c d e f g h i j k l', 60, null, estilo({ limiteLinhas: 2, overflow: 'cortar' }));
  assert.ok(r.truncou);
  assert.ok(r.linhas.length <= 2);
  assert.ok(r.linhas[r.linhas.length - 1].endsWith('…'));
});

test('compor produz SVG com dimensões e texto interpolado', () => {
  const variante: Variante = {
    chave: '9:16', papel: 'principal', nome: 'x', largura: 1080, altura: 1920,
    elementos: [
      { id: 't', tipo: 'texto', x: 40, y: 100, w: 1000, valor: 'Olá {{nome}}', camada: 2, estilo: estilo({ cor: 'text' }) },
    ],
  };
  const { svg, largura, altura } = compor({
    variante, paleta: PALETA_PADRAO, estilos: {}, dados: { nome: 'Cujubim' }, imagens: {},
  });
  assert.equal(largura, 1080);
  assert.equal(altura, 1920);
  assert.match(svg, /width="1080"/);
  assert.match(svg, /Ol&aacute;|Olá/);
  assert.match(svg, /Cujubim/);
});

test('compor é determinístico', () => {
  const variante: Variante = {
    chave: '3:4', papel: 'principal', nome: 'x', largura: 1080, altura: 1440,
    elementos: [{ id: 'r', tipo: 'retangulo', x: 0, y: 0, w: 100, h: 100, fill: 'primary', camada: 1 }],
  };
  const a = compor({ variante, paleta: PALETA_PADRAO, estilos: {}, dados: {}, imagens: {} });
  const b = compor({ variante, paleta: PALETA_PADRAO, estilos: {}, dados: {}, imagens: {} });
  assert.equal(a.svg, b.svg);
});

test('validarComposicao bloqueia campo obrigatório vazio', () => {
  const campos: Campo[] = [{ chave: 'titulo', rotulo: 'Título', tipo: 'texto', obrigatorio: true }];
  const variante: Variante = { chave: '9:16', papel: 'principal', nome: 'x', largura: 1080, altura: 1920, elementos: [] };
  const comp = compor({ variante, paleta: PALETA_PADRAO, estilos: {}, dados: {}, imagens: {} });
  const res = validarComposicao({ variante, campos, dados: {}, paleta: PALETA_PADRAO, composicao: comp });
  assert.equal(res.ok, false);
  assert.ok(res.bloqueadores.some((p) => p.codigo === 'campo_obrigatorio'));
});

test('validarComposicao bloqueia imagem ausente', () => {
  const variante: Variante = {
    chave: '9:16', papel: 'principal', nome: 'x', largura: 1080, altura: 1920,
    elementos: [{ id: 'img', tipo: 'imagem', x: 0, y: 0, w: 100, h: 100, ajuste: 'cover', camada: 1 }],
  };
  const comp = compor({ variante, paleta: PALETA_PADRAO, estilos: {}, dados: {}, imagens: {} });
  const res = validarComposicao({ variante, campos: [], dados: {}, paleta: PALETA_PADRAO, composicao: comp, imagensResolvidas: {} });
  assert.ok(res.bloqueadores.some((p) => p.codigo === 'imagem_ausente'));
});

test('paleta: contraste e validação', () => {
  assert.ok(razaoContraste('#000000', '#FFFFFF') > 20);
  assert.equal(resolverCor('primary', PALETA_PADRAO), '#17365D');
  assert.deepEqual(validarPaleta(PALETA_PADRAO), []);
});

test('svgParaPng gera um PNG do tamanho pedido', async () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="108" height="192"><rect width="108" height="192" fill="#17365D"/></svg>';
  const buf = await svgParaPng(svg, 108, 192);
  assert.ok(buf.length > 0);
  assert.equal(buf.slice(1, 4).toString('ascii'), 'PNG');
});
