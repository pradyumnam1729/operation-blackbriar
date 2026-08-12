// Product-line logos — one per line, shared across its modules (Plan/Build/
// Maintain). Static assets in public/logos/, served at the site root by Vite.

export const LINE_LOGOS: Record<string, string> = {
  Masterworks: "/logos/masterworks.png",
  Primus: "/logos/primus.png",
};

/** Best-effort match on a product's `line` field; undefined if unmatched. */
export function lineLogo(line: string | null | undefined): string | undefined {
  if (!line) return undefined;
  if (LINE_LOGOS[line]) return LINE_LOGOS[line];
  const hit = Object.keys(LINE_LOGOS).find((l) => line.startsWith(l));
  return hit ? LINE_LOGOS[hit] : undefined;
}
