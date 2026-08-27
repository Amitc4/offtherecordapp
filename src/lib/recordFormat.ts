/**
 * @file recordFormat.ts — Helpers for reading a release's physical format string
 * (e.g. "2 x Vinyl, LP, Album" or "CD, Album") and for naming per-disc scan sides.
 *
 * Multi-disc releases are graded one disc at a time. To stay backwards compatible
 * with existing single-disc data, disc 1 keeps the plain side keys "A" / "B" and
 * later discs got the disc number appended: "A2", "B2", "A3"…
 *
 * Newer scans capture **two angles per side** (A1/A2 and B1/B2). To avoid
 * colliding with the old "A2" = disc 2 side A convention, the new storage key
 * format is `<disc>-<side>-<angle>` (e.g. "1-A-1", "1-A-2", "2-B-1"). The
 * helper functions below parse both the legacy and the new format.
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

/**
 * Side key stored in `record_surface_scans.side` for a given disc, side and
 * optional angle. New scans use two angles per side; the default angle is 1.
 */
export const sideKey = (disc: number, side: "A" | "B", angle = 1): string =>
  `${disc}-${side}-${angle}`;

/** Parse the side key into its components, supporting both legacy and new keys. */
const parseSideKey = (key?: string | null): { disc: number; side: string; angle: number } => {
  if (!key) return { disc: 1, side: "A", angle: 1 };
  const clean = key.trim();

  // New format: "1-A-1", "2-B-2"
  const parts = clean.split("-");
  if (parts.length === 3) {
    const disc = parseInt(parts[0], 10);
    const side = parts[1].toUpperCase();
    const angle = parseInt(parts[2], 10);
    return {
      disc: Number.isFinite(disc) && disc > 0 ? disc : 1,
      side: side === "A" || side === "B" ? side : "A",
      angle: Number.isFinite(angle) && angle > 0 ? angle : 1,
    };
  }

  // Legacy formats: "A", "B", "A2", "B2"
  const letter = clean.replace(/\d+$/, "").toUpperCase();
  const trailing = clean.match(/(\d+)$/);
  const disc = trailing ? parseInt(trailing[1], 10) : 1;
  return {
    disc: Number.isFinite(disc) && disc > 0 ? disc : 1,
    side: letter === "A" || letter === "B" ? letter : "A",
    angle: 1,
  };
};

/** Disc number encoded in a stored side key ("B2" → 2, "2-A-1" → 2, "A" → 1). */
export const discOfSideKey = (key?: string | null): number => parseSideKey(key).disc;

/** Side letter encoded in a stored side key ("A", "B"). */
export const sideOfSideKey = (key?: string | null): string => parseSideKey(key).side;

/** Angle number encoded in a stored side key ("1-A-2" → 2, legacy keys → 1). */
export const angleOfSideKey = (key?: string | null): number => parseSideKey(key).angle;

/** Base side key without the angle, used to group multiple angles of one side. */
export const baseSideKey = (key?: string | null): string => {
  const { disc, side } = parseSideKey(key);
  return `${disc}-${side}`;
};

/** Human label for a stored side key: "A" → "Side A", "1-A-2" → "Side A2". */
export const sideKeyLabel = (key: string): string => {
  const { disc, side, angle } = parseSideKey(key);
  const angleSuffix = angle > 1 ? `${angle}` : "";
  const sideText = `Side ${side}${angleSuffix}`;
  return disc > 1 ? `Disc ${disc} · ${sideText}` : sideText;
};
