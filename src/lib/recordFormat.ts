/**
 * @file recordFormat.ts — Helpers for reading a release's physical format string
 * (e.g. "2 x Vinyl, LP, Album" or "CD, Album") and for naming per-disc scan sides.
 *
 * Multi-disc releases are graded one disc at a time. To stay backwards compatible
 * with existing single-disc data, disc 1 keeps the plain side keys "A" / "B" and
 * later discs get the disc number appended: "A2", "B2", "A3"…
 */

/** Maximum number of discs we let a user grade individually. */
const MAX_DISCS = 6;

/**
 * Number of discs a format string describes. Recognises "2 x Vinyl", "2xLP",
 * "3 LP", "2 discs" etc. Defaults to 1 when no count is present.
 */
export const discCount = (format?: string | null): number => {
  if (!format) return 1;
  const f = format.toLowerCase();
  const multi = f.match(/(\d+)\s*(?:x|×)\s*/);
  const counted = f.match(/(\d+)\s*(?:lp|lps|vinyl|discs?|cds?)/);
  const n = parseInt((multi?.[1] || counted?.[1] || "1"), 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_DISCS);
};

/** True when the item is a CD (and not a vinyl release) — CDs are never graded. */
export const isCdFormat = (format?: string | null): boolean => {
  if (!format) return false;
  const f = format.toLowerCase();
  if (/vinyl|\blp\b|\bep\b|\b7"|\b10"|\b12"/.test(f)) return false;
  return /\bcds?\b|compact disc/.test(f);
};

/** Side key stored in `record_surface_scans.side` for a given disc + side. */
export const sideKey = (disc: number, side: "A" | "B"): string =>
  disc <= 1 ? side : `${side}${disc}`;

/** Disc number encoded in a stored side key ("B2" → 2, "A" → 1). */
export const discOfSideKey = (key?: string | null): number => {
  const m = (key || "").match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : 1;
};

/** Human label for a stored side key: "A" → "Side A", "B2" → "Disc 2 · Side B". */
export const sideKeyLabel = (key: string): string => {
  const letter = (key || "").replace(/\d+$/, "").toUpperCase();
  const disc = discOfSideKey(key);
  return disc > 1 ? `Disc ${disc} · Side ${letter}` : `Side ${letter}`;
};
