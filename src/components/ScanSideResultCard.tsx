/**
 * @file ScanSideResultCard.tsx — One result card per record side (A / B).
 *
 * Renders the scanner overlay image (tappable for full screen), the returned
 * grade, the mark count with an expandable list of detections, the assessed
 * surface coverage, and any warnings the API returned (verbatim, as amber
 * alerts). Failed sides are marked clearly instead of hiding the whole result.
 */
import { useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle, TriangleAlert } from "lucide-react";
import { MIN_JUDGED_PCT } from "@/config/scanner";
import { formatGrade, type SideResult } from "@/lib/scannerApi";

interface ScanSideResultCardProps {
  side: string;
  result: SideResult;
  onViewOverlay: (dataUri: string) => void;
}

const ScanSideResultCard = ({ side, result, onViewOverlay }: ScanSideResultCardProps) => {
  const [marksOpen, setMarksOpen] = useState(false);

  if (!result.ok || !result.analysis) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4">
        <p className="font-display text-sm font-bold text-destructive flex items-center gap-2">
          <TriangleAlert size={16} />
          Side {side} — analysis failed
        </p>
        <p className="font-body text-xs text-destructive/80 mt-1">
          {result.error || "Unknown error"}
        </p>
      </div>
    );
  }

  const a = result.analysis;

  // The scanner matched the two photos of this side but could not align them.
  // The photo is returned unmarked; we must not show a grade or "0 marks" as a perfect result.
  if (a.status && a.status !== "ok") {
    return (
      <div className="rounded-xl border border-amber-500/50 bg-amber-500/15 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-display text-sm font-bold text-amber-700 flex items-center gap-2">
            <AlertTriangle size={16} />
            Side {side} — photos didn't match
          </p>
          <span className="font-body text-[10px] uppercase tracking-wide text-amber-700/80">
            Needs retake
          </span>
        </div>
        <p className="font-body text-xs text-amber-700 mt-2">
          {a.message || "The two photos of this side could not be matched to each other. Please photograph that side again."}
        </p>
        {a.overlay_png && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => onViewOverlay(a.overlay_png as string)}
              className="block w-full overflow-hidden rounded-lg border border-border"
              aria-label={`View unmarked photo of side ${side} full screen`}
            >
              <img
                src={a.overlay_png}
                alt={`Unmarked photo of side ${side}`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </button>
            <p className="font-body text-[10px] text-muted-foreground mt-1 text-center">
              Returned unmarked
            </p>
          </div>
        )}
      </div>
    );
  }


  const marks = Array.isArray(a.marks) ? a.marks : [];
  const markCount = typeof a.mark_count === "number" ? a.mark_count : marks.length;
  const judged = a.coverage?.judged_pct;
  const lowCoverage = typeof judged === "number" && judged < MIN_JUDGED_PCT;
  const warnings = Array.isArray(a.warnings) ? a.warnings : [];

  return (
    <div className="rounded-xl bg-card p-4 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-display text-lg font-bold text-foreground">{formatGrade(a.grade)}</p>
        <span className="font-body text-[10px] uppercase tracking-wide text-muted-foreground">
          Side {side}
        </span>
      </div>

      {a.overlay_png && (
        <div>
          <button
            type="button"
            onClick={() => onViewOverlay(a.overlay_png as string)}
            className="block w-full overflow-hidden rounded-lg border border-border"
            aria-label={`View detected marks on side ${side} full screen`}
          >
            <img
              src={a.overlay_png}
              alt={`Detected marks on side ${side}`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </button>
          <p className="font-body text-[10px] text-muted-foreground mt-1 text-center">
            Detected marks
          </p>
        </div>
      )}

      {typeof judged === "number" && (
        <p className="font-body text-xs text-muted-foreground">
          Surface assessed: {Math.round(judged)}%
        </p>
      )}

      {lowCoverage && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/15 p-3">
          <p className="font-display text-xs font-bold text-amber-600 flex items-center gap-1.5">
            <AlertTriangle size={14} />
            Photo could not be fully assessed
          </p>
          <p className="font-body text-[11px] text-amber-700 mt-1">
            Only {Math.round(judged as number)}% of the surface was judged. A re-shoot is advised —
            fill the frame with the disc and avoid glare.
          </p>
        </div>
      )}

      {warnings.map((w, i) => (
        <div
          key={i}
          className="rounded-lg border border-amber-500/50 bg-amber-500/15 px-3 py-2 flex items-start gap-1.5"
        >
          <AlertTriangle size={13} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="font-body text-[11px] text-amber-700">{w}</p>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setMarksOpen((v) => !v)}
        className="flex items-center justify-between rounded-lg bg-background px-3 py-2"
        disabled={marks.length === 0}
      >
        <span className="font-body text-xs font-semibold text-foreground">
          {markCount} {markCount === 1 ? "mark" : "marks"} detected
        </span>
        {marks.length > 0 &&
          (marksOpen ? (
            <ChevronUp size={14} className="text-muted-foreground" />
          ) : (
            <ChevronDown size={14} className="text-muted-foreground" />
          ))}
      </button>

      {marksOpen && marks.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {marks.map((m, i) => (
            <li key={i} className="rounded-lg bg-background px-3 py-2">
              <p className="font-body text-[11px] font-semibold text-foreground">Mark {i + 1}</p>
              <p className="font-body text-[11px] text-muted-foreground">
                Length: {m.length_px ?? "—"} px · Thickness: {m.thickness_px ?? "—"} px · Angle to
                groove: {m.angle_to_groove_deg ?? "—"}°
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ScanSideResultCard;
