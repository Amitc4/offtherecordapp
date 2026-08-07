/**
 * @file gradingScans.ts — Reads the stored per-side surface-scan results used by the
 * grading-photos gallery (annotated overlay image + grade, mark count, coverage).
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SideScanSummary } from "@/components/GradingPhotosViewer";

interface ScanRow {
  side: string | null;
  grade: string | null;
  mark_count: number | null;
  judged_pct: number | null;
  overlay_url: string | null;
  raw_photo_url: string | null;
}

const toSummary = (rows: ScanRow[]): SideScanSummary[] => {
  const seen = new Set<string>();
  const out: SideScanSummary[] = [];
  for (const r of rows) {
    const side = (r.side || "").toUpperCase();
    if (!side || seen.has(side)) continue;
    seen.add(side);
    out.push({
      side,
      overlayUrl: r.overlay_url,
      rawUrl: r.raw_photo_url,
      grade: r.grade,
      markCount: r.mark_count,
      judgedPct: r.judged_pct != null ? Number(r.judged_pct) : null,
    });
  }
  return out;
};

const SELECT = "side, grade, mark_count, judged_pct, overlay_url, raw_photo_url, created_at";


/** Latest scan per side for one grading-history entry. */
export const fetchScansByHistory = async (historyId: string): Promise<SideScanSummary[]> => {
  const { data } = await supabase
    .from("record_surface_scans")
    .select(SELECT)
    .eq("history_id", historyId)
    .order("created_at", { ascending: false });
  return toSummary((data as unknown as ScanRow[]) || []);
};

/** Latest scan per side for one record (used when no history id is available). */
export const fetchScansByRecord = async (recordId: string): Promise<SideScanSummary[]> => {
  const { data } = await supabase
    .from("record_surface_scans")
    .select(SELECT)
    .eq("record_id", recordId)
    .order("created_at", { ascending: false });
  return toSummary((data as unknown as ScanRow[]) || []);
};

/** Loads the latest per-side scans for a record while `enabled` is true. */
export const useRecordSideScans = (recordId?: string, enabled = true) => {
  const [sides, setSides] = useState<SideScanSummary[]>([]);

  useEffect(() => {
    if (!recordId || !enabled) return;
    let cancelled = false;
    fetchScansByRecord(recordId).then((s) => {
      if (!cancelled) setSides(s);
    });
    return () => {
      cancelled = true;
    };
  }, [recordId, enabled]);

  return sides;
};
