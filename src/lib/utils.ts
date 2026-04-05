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
