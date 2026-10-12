/**
 * Renderização determinística SVG → PNG e resolução de imagens dos ativos.
 *
 * Usa `sharp` (libvips + librsvg), já presente no ambiente, para rasterizar o
 * SVG em alta resolução. Se `sharp` falhar, o controller mantém o SVG como
 * fallback — a geração manual nunca é bloqueada por falha de renderização.
 */

import fs from 'fs';
import path from 'path';

const MIME_POR_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

/** Converte um SVG em um PNG no tamanho indicado. */
export async function svgParaPng(svg: string, largura: number, altura: number): Promise<Buffer> {
  const mod: any = await import('sharp');
  const sharp = mod.default || mod;
  return sharp(Buffer.from(svg, 'utf-8'), { density: 72 })
    .resize(largura, altura, { fit: 'fill' })
    .png()
    .toBuffer();
}

export function sharpDisponivel(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return true;
  } catch {
    return false;
  }
}

/**
 * Lê uma imagem pública (ex.: /uploads/artes/ativos/x.png) e devolve um data
 * URI base64 para embutir no SVG. Bloqueia caminhos fora de public/uploads.
 */
export function imagemParaDataUri(urlPublica: string | null | undefined): string | null {
  if (!urlPublica) return null;
  try {
    const limpa = String(urlPublica).split('?')[0];
    if (!limpa.startsWith('/uploads/')) return null;
    const abs = path.join(process.cwd(), 'public', limpa.replace(/^\//, ''));
    const publicRoot = path.join(process.cwd(), 'public');
    if (!path.resolve(abs).startsWith(path.resolve(publicRoot))) return null;
    if (!fs.existsSync(abs)) return null;
    const ext = path.extname(abs).toLowerCase();
    const mime = MIME_POR_EXT[ext] || 'application/octet-stream';
    const b64 = fs.readFileSync(abs).toString('base64');
    return `data:${mime};base64,${b64}`;
  } catch {
    return null;
  }
}

/** Garante e devolve o diretório de saída public/uploads/artes/geracoes. */
export function dirGeracoes(): string {
  const dir = path.join(process.cwd(), 'public', 'uploads', 'artes', 'geracoes');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function dirAtivos(): string {
  const dir = path.join(process.cwd(), 'public', 'uploads', 'artes', 'ativos');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
