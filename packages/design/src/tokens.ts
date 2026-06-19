/**
 * Crestly Design Tokens · v1.0 · Warm Indian SaaS (Direction B)
 *
 * TypeScript mirror of styles/tokens.css. Keep in sync — these values are
 * the canonical reference. Used at runtime where CSS variables aren't
 * enough (per-tenant brand-colour injection, charts, SVG composition).
 */

export const ink = {
  100: "#100D0A",
  90: "#1A1714",
  80: "#2A2520",
  60: "#4A4239",
  40: "#7A7066",
  20: "#B5ACA0",
} as const;

export const surface = {
  white: "#FFFFFF",
  whiteSoft: "#FAFAFA",
  paper: "#FBF9F3",
  creamSoft: "#FAF6EC",
  cream: "#F5EFE3",
  creamDeep: "#EBE3D1",
} as const;

export const orange = {
  base: "#F25C19",
  deep: "#C9460C",
  soft: "#FF7B3D",
  tint: "#FCE4D6",
} as const;

export const tint = {
  mint:    { base: "#D6E8D9", deep: "#3E7A50" }, // attendance / active
  peach:   { base: "#F5DCC4", deep: "#A65A22" }, // archive
  rose:    { base: "#F5D6CE", deep: "#A03A28" }, // totals / financial
  mustard: { base: "#EFE2BE", deep: "#7A5A18" }, // primary counts
  wheat:   { base: "#F0E5C8", deep: "#6E5418" }, // session / class
  sky:     { base: "#D5E2EE", deep: "#27517E" }, // info / links
} as const;
export type TintName = keyof typeof tint;

export const semantic = {
  success: { base: "#1F6F4A", soft: "#DDEBE0" },
  warn:    { base: "#C97A0A", soft: "#F6E6C9" },
  error:   { base: "#B83520", soft: "#F4D9D2" },
  info:    { base: "#2A5FA8", soft: "#D6E1F0" },
} as const;

export const rule = {
  base: "rgba(16,13,10,0.10)",
  soft: "rgba(16,13,10,0.06)",
  strong: "rgba(16,13,10,0.18)",
  onInk: "rgba(245,239,227,0.12)",
} as const;

export const font = {
  display: '"Geist", "Helvetica Neue", Helvetica, Arial, sans-serif',
  body:    '"Geist", "Helvetica Neue", Helvetica, Arial, sans-serif',
  mono:    '"Geist Mono", ui-monospace, "SF Mono", Menlo, monospace',
} as const;

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32, 8: 48, 9: 64, 10: 96 } as const;
export const radius = { 1: 4, 2: 6, 3: 8, 4: 12, 5: 16, pill: 999 } as const;

export const motion = {
  ease: "cubic-bezier(0.2, 0.7, 0.2, 1)",
  fast: "120ms",
  med: "200ms",
} as const;

/**
 * Build the per-tenant brand-colour override style block. The PHP app
 * emits this inline in <head>; we mirror that exactly so a school's
 * brand colour replaces --orange / --orange-deep / --orange-soft across
 * the entire UI without touching components.
 */
export function brandOverrideStyle(hex: string | null | undefined): string {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return "";
  // Use the same hex for all three slots — same as PHP, which doesn't
  // attempt to compute a darker/lighter shade.
  return `:root{--orange:${hex};--orange-deep:${hex};--orange-soft:${hex};}`;
}
