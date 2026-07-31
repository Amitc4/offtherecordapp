/**
 * @file utils.ts — Shared utility functions.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind CSS class names intelligently.
 *
 * Combines `clsx` (conditional class joining) with `twMerge` (deduplicates
 * and resolves conflicting Tailwind utilities so the last one wins).
 *
 * @example
 * cn("px-4 py-2", isActive && "bg-primary", "px-6")
 * // → "py-2 px-6 bg-primary"   (px-6 overrides px-4)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns true when the text contains Hebrew characters.
 */
export function isHebrew(text?: string | null): boolean {
  return !!text && /[\u0590-\u05FF]/.test(text);
}

/**
 * Tailwind classes that align record titles/artists right for Hebrew text
 * and left (default) for Latin text.
 */
export function textDirClass(text?: string | null): string {
  return isHebrew(text) ? "text-right dir-rtl" : "text-left";
}

/**
 * Cleans a Discogs-style multi-language name for display.
 *
 * Discogs stores translated equivalents joined by "=" (e.g.
 * "מחכים למשיח = Waiting For Messiah") and disambiguation markers ("*").
 * For display we keep only ONE variant — the Hebrew one when present —
 * so Hebrew albums/artists don't show their English equivalent.
 * The raw value is still used for searching/matching in the backend.
 */
export function displayName(text?: string | null): string {
  if (!text) return "";
  const cleanSegment = (segment: string): string => {
    const variants = segment
      .split(/\s*=\s*/)
      .map((v) => v.replace(/\*/g, "").trim())
      .filter(Boolean);
    if (variants.length === 0) return "";
    const hebrew = variants.find((v) => isHebrew(v));
    return hebrew ?? variants[0];
  };
  return text
    .split(",")
    .map((s) => cleanSegment(s))
    .filter(Boolean)
    .join(", ");
}
