/**
 * Paletas semânticas e utilidades de cor do gerador de artes.
 */

import type { CorRef } from './types.ts';

export const CHAVES_PALETA = [
  'primary', 'secondary', 'accent', 'background', 'surface',
  'text', 'mutedText', 'border', 'success', 'warning', 'danger',
] as const;

export type ChavePaleta = typeof CHAVES_PALETA[number];

/** Paleta ilustrativa padrão (não é a identidade oficial do município). */
export const PALETA_PADRAO: Record<ChavePaleta, string> = {
  primary: '#17365D',
  secondary: '#2878B5',
  accent: '#F2B544',
  background: '#F3F5F7',
  surface: '#FFFFFF',
  text: '#202833',
  mutedText: '#5B6673',
  border: '#D8DEE5',
  success: '#1F9D55',
  warning: '#D97706',
  danger: '#DC2626',
};

/** Normaliza um valor de cor para [#rrggbb] maiúsculo. Aceita rgb() e nomes simples. */
export function normalizarHex(valor: string): string {
  if (!valor) return '#000000';
  let v = String(valor).trim();
  if (/^#([0-9a-f]{3})$/i.test(v)) {
    v = '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
  }
  if (/^#([0-9a-f]{6})$/i.test(v)) return v.toUpperCase();
  const m = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) {
    const h = (n: number) => n.toString(16).padStart(2, '0');
    return `#${h(+m[1])}${h(+m[2])}${h(+m[3])}`.toUpperCase();
  }
  return '#000000';
}

export function ehHexValido(valor: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(valor || '').trim());
}

/** Resolve uma referência de cor (chave semântica ou hex) para hex. */
export function resolverCor(cor: CorRef, paleta: Record<string, string>): string {
  if (!cor) return '#000000';
  const c = String(cor).trim();
  if (c.startsWith('#') || c.startsWith('rgb')) return normalizarHex(c);
  if (paleta && paleta[c]) return normalizarHex(paleta[c]);
  return '#000000';
}

export function validarPaleta(cores: Record<string, string>): string[] {
  const erros: string[] = [];
  for (const chave of CHAVES_PALETA) {
    const valor = cores?.[chave];
    if (!valor) { erros.push(`Cor ausente: ${chave}`); continue; }
    if (!ehHexValido(valor) && !/^rgba?\(/i.test(valor)) erros.push(`Cor inválida em ${chave}: ${valor}`);
  }
  return erros;
}

// ── Contraste (WCAG) ────────────────────────────────────────────────────────

function canalLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function luminancia(hex: string): number {
  const h = normalizarHex(hex);
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  return 0.2126 * canalLinear(r) + 0.7152 * canalLinear(g) + 0.0722 * canalLinear(b);
}

/** Razão de contraste WCAG entre duas cores (1 a 21). */
export function razaoContraste(corA: string, corB: string): number {
  const l1 = luminancia(corA);
  const l2 = luminancia(corB);
  const claro = Math.max(l1, l2);
  const escuro = Math.min(l1, l2);
  return (claro + 0.05) / (escuro + 0.05);
}

/** Mistura duas cores (t=0 → a; t=1 → b). */
export function misturar(a: string, b: string, t: number): string {
  const ha = normalizarHex(a);
  const hb = normalizarHex(b);
  const p = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  const r = Math.round(p(ha, 1) * (1 - t) + p(hb, 1) * t);
  const g = Math.round(p(ha, 3) * (1 - t) + p(hb, 3) * t);
  const bl = Math.round(p(ha, 5) * (1 - t) + p(hb, 5) * t);
  const hx = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hx(r)}${hx(g)}${hx(bl)}`.toUpperCase();
}

export function comOpacidade(hex: string, opacidade: number): string {
  const h = normalizarHex(hex);
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, opacidade))})`;
}
