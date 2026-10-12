/**
 * Tipos do motor determinístico de composição de artes.
 *
 * A fonte de verdade é o SVG gerado a partir do template + dados. A partir
 * dele a prévia é exibida no navegador e o PNG é rasterizado no servidor
 * (ver `render.ts`).
 */

export type CorRef = string; // chave semântica da paleta (ex.: 'primary') ou hex (#rrggbb)

export interface EstiloTexto {
  familia: string;
  peso: number;
  tamanho: number;
  tamanhoMin: number;
  alturaLinha: number;
  espacamentoLetras: number;
  alinhamento: 'left' | 'center' | 'right';
  cor: CorRef;
  limiteLinhas: number | null;
  margem: number;
  overflow: 'diminuir' | 'cortar' | 'avisar';
}

export interface Sombra {
  cor?: CorRef;
  blur?: number;
  x?: number;
  y?: number;
  opacidade?: number;
}

export interface ElementoBase {
  id: string;
  tipo: string;
  nome?: string;
  camada: number;
  bloqueado?: boolean;
  oculto?: boolean;
  institucional?: boolean;
  opacidade?: number;
  sombra?: Sombra;
}

export interface ElRetangulo extends ElementoBase {
  tipo: 'retangulo';
  x: number; y: number; w: number; h: number;
  fill: CorRef;
  raio?: number;
}

export interface ElCirculo extends ElementoBase {
  tipo: 'circulo';
  cx: number; cy: number; r: number;
  fill: CorRef;
}

export interface ElLinha extends ElementoBase {
  tipo: 'linha';
  x1: number; y1: number; x2: number; y2: number;
  cor: CorRef;
  espessura: number;
}

export interface ElImagem extends ElementoBase {
  tipo: 'imagem';
  x: number; y: number; w: number; h: number;
  url?: string;
  ativoId?: number;
  ajuste: 'cover' | 'contain';
  raio?: number;
  editavel?: boolean;
  placeholder?: string;
  /** Cor para tingir a imagem (usa o alfa como máscara — ideal p/ ícones/silhuetas). */
  cor?: CorRef;
}

export interface ElTexto extends ElementoBase {
  tipo: 'texto';
  x: number; y: number; w: number;
  valor: string; // pode conter {{campo}}
  variavel?: string; // campo dinâmico vinculado
  estiloId?: number;
  estilo?: Partial<EstiloTexto>;
  editavel?: boolean;
  fixo?: boolean; // texto institucional que não deve ser alterado
  cor?: CorRef; // sobrescreve a cor do estilo
}

export type Elemento = ElRetangulo | ElCirculo | ElLinha | ElImagem | ElTexto;

export interface Variante {
  chave: string;
  papel: 'principal' | 'capa' | 'interna' | 'final';
  nome: string;
  largura: number;
  altura: number;
  fundo?: CorRef;
  elementos: Elemento[];
}

export interface Campo {
  chave: string;
  rotulo: string;
  tipo: 'texto' | 'textarea' | 'data' | 'hora' | 'url' | 'numero';
  obrigatorio: boolean;
  maxCaracteres?: number;
  fatoSensivel?: boolean; // datas, horários, valores, contatos — preservados pela IA
}

export interface ComposicaoInput {
  variante: Variante;
  paleta: Record<string, string>;
  estilos: Record<number, EstiloTexto>;
  dados: Record<string, string>;
  /** Map id do elemento -> data URI já resolvido (imagem ausente = elemento omitido). */
  imagens: Record<string, string>;
}

export interface ResultadoComposicao {
  svg: string;
  largura: number;
  altura: number;
  /** Diagnósticos de texto por elemento (para o validador). */
  textoDiagnostico: DiagnosticoTexto[];
}

export interface DiagnosticoTexto {
  elementoId: string;
  linhas: number;
  limiteLinhas: number | null;
  fontSize: number;
  fontSizeMin: number;
  reduziu: boolean;
  excedeu: boolean;
  truncou: boolean;
}
