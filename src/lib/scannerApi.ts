/**
 * @file scannerApi.ts — Client for the external vinyl surface-analysis API.
 *
 * One request per image: `POST /analyze` with `multipart/form-data` and a single
 * `image` field. The Content-Type header is intentionally NOT set so the browser
 * generates the multipart boundary itself.
 */
import { SCANNER_ANALYZE_URL } from "@/config/scanner";

/** A single detected surface mark. */
export interface ScanMark {
  length_px?: number;
  thickness_px?: number;
  angle_to_groove_deg?: number;
  [key: string]: unknown;
}

/** Raw analysis payload returned by the scanner for one image. */
export interface ScanAnalysis {
  analysis_id?: string;
  grade?: string;
  mark_count?: number;
  marks?: ScanMark[];
  overlay_png?: string;
  coverage?: { judged_pct?: number; [key: string]: unknown };
  warnings?: string[];
  [key: string]: unknown;
}

/** Per-side result, including the failure case so one side can fail alone. */
export interface SideResult {
  ok: boolean;
  analysis?: ScanAnalysis;
  error?: string;
}

/** Analyse one image. Never throws — failures come back as `{ ok: false }`. */
export const analyzeImage = async (file: File): Promise<SideResult> => {
  try {
    const form = new FormData();
    form.append("image", file, file.name || "image.jpg");

    // No Content-Type header on purpose: the browser adds the boundary.
    const resp = await fetch(SCANNER_ANALYZE_URL, { method: "POST", body: form });

    if (!resp.ok) {
      return { ok: false, error: `Analysis failed (HTTP ${resp.status}).` };
    }
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
