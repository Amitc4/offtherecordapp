/**
 * @file scannerApi.ts — Client for the external vinyl surface-analysis API.
 *
 * Two endpoints are used:
 *  - `POST /analyze-record` — the whole record in one request: four files
 *    (`side_a_1`, `side_a_2`, `side_b_1`, `side_b_2`). Returns the record grade
 *    (already the worse of the two sides), a per-side result, and every photo
 *    with the detected marks painted on as a ready `data:` URL.
 *  - `POST /analyze` — one side only (`image`, optional `second_image`).
 *
 * The `Content-Type` header is intentionally NOT set so the browser generates
 * the multipart boundary itself.
 */
import {
  SCANNER_ANALYZE_RECORD_URL,
  SCANNER_ANALYZE_URL,
  SCANNER_HEALTH_URL,
} from "@/config/scanner";

/** A single detected surface mark. */
export interface ScanMark {
  length_px?: number;
  thickness_px?: number;
  angle_to_groove_deg?: number;
  [key: string]: unknown;
}

/** One photo of a side, as returned inside `sides.X.photos[]`. */
export interface ScanPhoto {
  overlay_png?: string;
  coverage?: { judged_pct?: number; [key: string]: unknown };
  disc?: { found_by?: string; [key: string]: unknown };
  [key: string]: unknown;
}

/** Per-side payload returned by the scanner. */
export interface ScanSide {
  status?: string;
  needs_retake?: boolean;
  message?: string;
  grade?: string;
  quality_score?: number;
  mark_count?: number;
  cross_shot?: { used?: boolean; [key: string]: unknown };
  marks?: ScanMark[];
  photos?: ScanPhoto[];
  warnings?: string[];
  [key: string]: unknown;
}


/** Analysis payload shown in the UI for one photo (one card). */
export interface ScanAnalysis {
  analysis_id?: string;
  status?: string;
  needs_retake?: boolean;
  message?: string;
  grade?: string;
  quality_score?: number;
  mark_count?: number;
  marks?: ScanMark[];
  overlay_png?: string;
  coverage?: { judged_pct?: number; [key: string]: unknown };
  warnings?: string[];
  [key: string]: unknown;
}

/** Per-photo result, including the failure case so one photo can fail alone. */
export interface SideResult {
  ok: boolean;
  analysis?: ScanAnalysis;
  error?: string;
}

/** Whole-record analysis result. */
export interface RecordScanResult {
  ok: boolean;
  error?: string;
  /** Scanner status: "ok" for a successful analysis, or "alignment_failed" when a side could not be matched. */
  status?: string;
  /** Human-readable explanation when `status` is not "ok". */
  message?: string;
  needs_retake?: boolean;
  /** Letters of the sides that must be re-photographed (e.g. ["A"]). */
  sides_to_retake?: string[];
  /** Record grade — already the worse of the two sides, only present when `status` is "ok". */
  grade?: string;
  quality_score?: number;
  graded_from_side?: string;
  warnings?: string[];
  /** One entry per submitted photo, in A1, A2, B1, B2 order. */
  photos: SideResult[];
}

/** Raw whole-record response shape. */
interface RecordResponse {
  status?: string;
  needs_retake?: boolean;
  sides_to_retake?: string[];
  message?: string;
  grade?: string;
  quality_score?: number;
  graded_from_side?: string;
  warnings?: string[];
  sides?: { A?: ScanSide; B?: ScanSide };
  [key: string]: unknown;
}


/** Human-readable message for the scanner's documented error statuses. */
const errorForStatus = (status: number): string => {
  switch (status) {
    case 400:
      return "The scanner received an empty request. Please retake the photos.";
    case 413:
      return "One of the photos is too large (max 12 MB each).";
    case 415:
      return "Unsupported image format. Use JPEG, PNG, WEBP or BMP.";
    case 422:
      return "A photo could not be read. Retake it with the whole disc in frame.";
    default:
      return `Analysis failed (HTTP ${status}).`;
  }
};

/**
 * Wakes the scanner host so the first real request isn't stuck on a cold start.
 * Fire-and-forget: failures are ignored on purpose.
 */
export const wakeScanner = (): void => {
  void fetch(SCANNER_HEALTH_URL, { method: "GET" }).catch(() => {});
};

/** Extra per-photo warnings derived from the quality signals the API reports. */
const photoWarnings = (side: ScanSide, photo: ScanPhoto): string[] => {
  const out: string[] = [];
  if (side.cross_shot && side.cross_shot.used === false) {
    out.push("The two photos of this side didn't line up, so they were graded separately.");
  }
  if (photo.disc?.found_by === "fallback_centered") {
    out.push("The disc couldn't be located in this photo — fit the whole record in the frame.");
  }
  return out;
};

/** Turns one side + one of its photos into the analysis shape the UI renders. */
const toAnalysis = (side: ScanSide, photo: ScanPhoto): ScanAnalysis => ({
  grade: side.grade,
  quality_score: side.quality_score,
  mark_count:
    typeof side.mark_count === "number"
      ? side.mark_count
      : Array.isArray(side.marks)
        ? side.marks.length
        : undefined,
  marks: Array.isArray(side.marks) ? side.marks : [],
  overlay_png: photo.overlay_png,
  coverage: photo.coverage,
  warnings: [...(Array.isArray(side.warnings) ? side.warnings : []), ...photoWarnings(side, photo)],
});

/**
 * Analyse a whole record in one request. Never throws — failures come back as
 * `{ ok: false }`. `photos` always has four entries so it lines up with the
 * capture slots (A1, A2, B1, B2).
 *
 * @param files The four captures in A1, A2, B1, B2 order.
 * @param withOverlays When false, the grade comes back without the marked
 *        images (much smaller response). Defaults to true.
 */
export const analyzeRecord = async (
  files: [File, File, File, File],
  withOverlays = true
): Promise<RecordScanResult> => {
  const fail = (error: string): RecordScanResult => ({
    ok: false,
    error,
    photos: [0, 1, 2, 3].map(() => ({ ok: false, error })),
  });

  try {
    const form = new FormData();
    const fields = ["side_a_1", "side_a_2", "side_b_1", "side_b_2"] as const;
    fields.forEach((field, i) => {
      const file = files[i];
      form.append(field, file, file.name || `${field}.jpg`);
    });

    const url = withOverlays
      ? SCANNER_ANALYZE_RECORD_URL
      : `${SCANNER_ANALYZE_RECORD_URL}?overlay=false`;

    // No Content-Type header on purpose: the browser adds the boundary.
    const resp = await fetch(url, { method: "POST", body: form });

    if (!resp.ok) return fail(errorForStatus(resp.status));

    const data = (await resp.json()) as RecordResponse;
    const sideA = data.sides?.A ?? {};
    const sideB = data.sides?.B ?? {};

    // Slot order: A1, A2, B1, B2.
    const pairs: [ScanSide, number][] = [
      [sideA, 0],
      [sideA, 1],
      [sideB, 0],
      [sideB, 1],
    ];

    const photos: SideResult[] = pairs.map(([side, idx]) => {
      const photo = Array.isArray(side.photos) ? side.photos[idx] : undefined;
      if (!photo) {
        return { ok: false, error: "The scanner returned no result for this photo." };
      }
      return { ok: true, analysis: toAnalysis(side, photo) };
    });

    return {
      ok: true,
      grade: data.grade,
      quality_score: data.quality_score,
      graded_from_side: data.graded_from_side,
      warnings: Array.isArray(data.warnings) ? data.warnings : [],
      photos,
    };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not reach the analysis service.");
  }
};

/**
 * Analyse a single side (`POST /analyze`). `secondImage` is an optional extra
 * photo of the same side. Never throws.
 */
export const analyzeImage = async (file: File, secondImage?: File): Promise<SideResult> => {
  try {
    const form = new FormData();
    form.append("image", file, file.name || "image.jpg");
    if (secondImage) {
      form.append("second_image", secondImage, secondImage.name || "second.jpg");
    }

    const resp = await fetch(SCANNER_ANALYZE_URL, { method: "POST", body: form });

    if (!resp.ok) return { ok: false, error: errorForStatus(resp.status) };
    const data = (await resp.json()) as ScanAnalysis;
    return { ok: true, analysis: data };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not reach the analysis service.",
    };
  }
};

/** Grades ordered best → worst. */
const GRADE_ORDER = [
  { code: "NM", label: "Near Mint" },
  { code: "VG+", label: "Very Good Plus" },
  { code: "VG", label: "Very Good" },
  { code: "G+", label: "Good Plus" },
  { code: "G", label: "Good" },
  { code: "F", label: "Fair" },
  { code: "P", label: "Poor" },
];

/** Maps whatever the API returns onto a known grade index (-1 when unknown). */
const gradeIndex = (grade?: string): number => {
  if (!grade) return -1;
  const raw = grade.trim();
  const upper = raw.toUpperCase();
  const byCode = GRADE_ORDER.findIndex((g) => g.code === upper);
  if (byCode !== -1) return byCode;
  const byLabel = GRADE_ORDER.findIndex((g) => g.label.toLowerCase() === raw.toLowerCase());
  if (byLabel !== -1) return byLabel;
  // Tolerate strings like "VG+ (Very Good Plus)" or "Near Mint (NM)".
  const loose = GRADE_ORDER.findIndex(
    (g) => upper.includes(g.code) || raw.toLowerCase().includes(g.label.toLowerCase())
  );
  return loose;
};

/** Human-readable "NM — Near Mint" style label for a returned grade. */
export const formatGrade = (grade?: string): string => {
  const i = gradeIndex(grade);
  if (i === -1) return grade?.trim() || "—";
  return `${GRADE_ORDER[i].code} — ${GRADE_ORDER[i].label}`;
};

/** Normalises an API grade string onto its short code ("VG (Very Good)" → "VG"). */
export const gradeCode = (grade?: string): string | null => {
  const i = gradeIndex(grade);
  return i === -1 ? null : GRADE_ORDER[i].code;
};

/** Returns the worse of the supplied grades (worst wins). `null` when unknown. */
export const worstGrade = (grades: (string | undefined)[]): string | null => {
  let worst = -1;
  for (const g of grades) {
    const i = gradeIndex(g);
    if (i > worst) worst = i;
  }
  if (worst === -1) return null;
  return GRADE_ORDER[worst].code;
};
