/**
 * @file scanner.ts — Single source of truth for the vinyl surface-scanner API.
 *
 * The scanner is an external image-analysis service. It sleeps when idle, so the
 * first request after a pause can take up to a minute while the server wakes up.
 */

/** Base URL of the surface-analysis service. Change this in one place only. */
export const SCANNER_API_BASE_URL = "https://off-the-record-scanner.onrender.com";

/** Full endpoint for a single-image analysis (multipart/form-data, field `image`). */
export const SCANNER_ANALYZE_URL = `${SCANNER_API_BASE_URL}/analyze`;

/** Shown while the first request is in flight (cold start). */
export const SCANNER_COLD_START_NOTICE =
  "First scan can take up to a minute while the server wakes up.";

/** Below this judged coverage percentage we advise a re-shoot. */
export const MIN_JUDGED_PCT = 55;
