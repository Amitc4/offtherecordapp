/**
 * @file scanner.ts — Single source of truth for the vinyl surface-scanner API.
 *
 * The scanner is an external image-analysis service with no auth. It sleeps when
 * idle, so the first request after a pause can take 50+ seconds while the host
 * wakes up — `GET /health` is used to wake it early.
 */

/** Base URL of the surface-analysis service. Change this in one place only. */
export const SCANNER_API_BASE_URL = "https://off-the-record-scanner.onrender.com";

/**
 * Full-record endpoint: one `multipart/form-data` request with four files
 * (`side_a_1`, `side_a_2`, `side_b_1`, `side_b_2`). Returns the record grade,
 * a grade per side, and every photo with the marks painted on.
 */
export const SCANNER_ANALYZE_RECORD_URL = `${SCANNER_API_BASE_URL}/analyze-record`;

/** Single-side endpoint (`image`, optional `second_image`). */
export const SCANNER_ANALYZE_URL = `${SCANNER_API_BASE_URL}/analyze`;

/** Health probe — also used to wake the host before a real request. */
export const SCANNER_HEALTH_URL = `${SCANNER_API_BASE_URL}/health`;

/** Shown while the first request is in flight (cold start). */
export const SCANNER_COLD_START_NOTICE =
  "First scan can take up to a minute while the server wakes up.";

/** Below this judged coverage percentage we advise a re-shoot. */
export const MIN_JUDGED_PCT = 55;

/** Per-photo upload limit enforced by the scanner (12 MB). */
export const SCANNER_MAX_PHOTO_BYTES = 12 * 1024 * 1024;
