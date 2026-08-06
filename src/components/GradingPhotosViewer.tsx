/**
 * @file GradingPhotosViewer.tsx — Modal showing exactly two images for a grading:
 * the annotated analysis overlay for Side A and for Side B.
 *
 * Only the overlay images produced by the analysis server are displayed here (the
 * photo with detected marks highlighted). The raw photos the user took are kept in
 * storage — for re-analysis and future training data — but never shown here.
 *
 * Each side renders its own heading plus the stored result (grade, mark count and
 * assessed surface coverage). Sides with no result show a "Not graded yet" slot.
 * Tapping an image opens a full-screen viewer with pinch-to-zoom and free panning.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Disc3, X, AlertTriangle } from "lucide-react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { supabase } from "@/integrations/supabase/client";
import { MIN_JUDGED_PCT } from "@/config/scanner";

const BUCKET = "record-photos";

const extractPath = (url: string): string | null => {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
};

/**
 * Converts stored (private-bucket) public URLs into short-lived signed URLs.
 * Returns `null` until signing has finished so callers never render the raw
 * (unauthorised) URL first — doing so fires a spurious image error.
 */
const useSignedUrls = (urls: string[], open: boolean): string[] | null => {
  const [signed, setSigned] = useState<string[] | null>(null);
  const key = urls.join("|");

  useEffect(() => {
    if (!open) {
      setSigned(null);
      return;
    }
    if (urls.length === 0) {
      setSigned(urls);
      return;
    }
    const paths = urls.map(extractPath);
    const validPaths = paths.filter((p): p is string => !!p);
    if (validPaths.length === 0) {
      setSigned(urls);
      return;
    }
    let cancelled = false;
    setSigned(null);
    (async () => {
      const { data } = await supabase.storage.from(BUCKET).createSignedUrls(validPaths, 3600);
      if (cancelled) return;
      const map = new Map<string, string>();
      data?.forEach((d, i) => {
        if (d.signedUrl) map.set(validPaths[i], d.signedUrl);
      });
      setSigned(urls.map((u, i) => (paths[i] && map.get(paths[i]!)) || u));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, open]);

  return signed;
};


/** Stored analysis result for one record side. */
export interface SideScanSummary {
  /** "A" or "B". */
  side: string;
  /** Annotated overlay image URL (marks highlighted). */
  overlayUrl?: string | null;
  grade?: string | null;
  markCount?: number | null;
  judgedPct?: number | null;
}

interface GradingPhotosViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Stored per-side results. Missing sides are rendered as empty slots. */
  sides: SideScanSummary[];
}

const SIDES = ["A", "B"];

const GradingPhotosViewer = ({ open, onOpenChange, sides }: GradingPhotosViewerProps) => {
  const [zoomSide, setZoomSide] = useState<string | null>(null);

  const bySide = SIDES.map((s) => sides.find((x) => (x.side || "").toUpperCase() === s));
  const overlayUrls = bySide.map((s) => s?.overlayUrl || "");
  const signed = useSignedUrls(overlayUrls.filter(Boolean) as string[], open);

  // Re-align signed URLs back to their side slots.
  let cursor = 0;
  const displayUrls = overlayUrls.map((u) => (u ? signed[cursor++] || u : ""));

  const count = displayUrls.filter(Boolean).length;
  const zoomIdx = zoomSide ? SIDES.indexOf(zoomSide) : -1;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Disc3 size={18} className="text-primary" />
              Grading photos ({count})
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {SIDES.map((side, i) => (
              <SideBlock
                key={side}
                side={side}
                url={displayUrls[i]}
                scan={bySide[i]}
                onOpen={() => setZoomSide(side)}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {zoomIdx !== -1 && displayUrls[zoomIdx] && (
        <ZoomViewer
          url={displayUrls[zoomIdx]}
          label={`Side ${SIDES[zoomIdx]}`}
          onClose={() => setZoomSide(null)}
        />
      )}
    </>
  );
};

/** One side: heading, overlay thumbnail (or empty slot) and its stored result. */
const SideBlock = ({
  side,
  url,
  scan,
  onOpen,
}: {
  side: string;
  url?: string;
  scan?: SideScanSummary;
  onOpen: () => void;
}) => {
  const judged = scan?.judgedPct;
  const lowCoverage = typeof judged === "number" && judged < MIN_JUDGED_PCT;
  const [thumbFailed, setThumbFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  return (
    <div>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Side {side}
      </p>

      {url ? (
        <div className="flex items-start gap-3">
          {thumbFailed ? (
            <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-lg bg-muted p-1 text-center">
              <p className="font-body text-[10px] leading-tight text-muted-foreground">
                Image could not be loaded
              </p>
              <button
                type="button"
                onClick={() => {
                  setThumbFailed(false);
                  setAttempt((a) => a + 1);
                }}
                className="font-body text-[10px] font-semibold text-primary underline"
              >
                Retry
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpen}
              className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted"
              aria-label={`View side ${side} analysis image full screen`}
            >
              <img
                key={attempt}
                src={url}
                alt={`Detected marks on side ${side}`}
                className="h-full w-full object-cover transition-transform active:scale-95"
                onError={() => setThumbFailed(true)}
              />
            </button>
          )}


          <div className="flex-1 space-y-1">
            <p className="font-display text-sm font-bold text-foreground">
              {scan?.grade || "—"}
            </p>
            <p className="font-body text-xs text-muted-foreground">
              {scan?.markCount ?? 0} {(scan?.markCount ?? 0) === 1 ? "mark" : "marks"} detected
            </p>
            {typeof judged === "number" && (
              <p className="font-body text-xs text-muted-foreground">
                Surface assessed: {Math.round(judged)}%
              </p>
            )}
            {lowCoverage && (
              <p className="font-body text-[11px] text-amber-700 flex items-start gap-1">
                <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-600" />
                Photo could not be fully assessed — a re-shoot is advised.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Disc3 size={20} className="text-muted-foreground" />
          </div>
          <p className="font-body text-xs text-muted-foreground">Not graded yet</p>
        </div>
      )}
    </div>
  );
};

/**
 * Full-screen image viewer with pinch-to-zoom and free panning.
 *
 * Rendered through a portal into `document.body` so it escapes the modal's
 * stacking context and truly covers the screen. While open it locks page
 * scrolling, swallows Escape (so only the viewer closes, not the gallery
 * modal), and intercepts the device back gesture via a pushed history entry.
 *
 * It reuses the exact same `url` as the thumbnail — no second URL is built.
 */
const ZoomViewer = ({
  url,
  label,
  onClose,
}: {
  url: string;
  label: string;
  onClose: () => void;
}) => {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Lock scrolling behind the viewer.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Escape closes only this viewer: capture-phase + stopImmediatePropagation
    // runs before Radix's document-level (bubble) handler.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      onClose();
    };
    document.addEventListener("keydown", onKeyDown, true);

    // Device back gesture closes the viewer instead of navigating away.
    window.history.pushState({ zoomViewer: true }, "");
    const onPopState = () => onClose();
    window.addEventListener("popstate", onPopState);

    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("popstate", onPopState);
      if (window.history.state?.zoomViewer) window.history.back();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-foreground/95" style={{ touchAction: "none" }}>
      <button
        className="absolute right-4 top-4 z-10 rounded-full bg-background/20 p-2 text-background"
        onClick={onClose}
        aria-label="Close"
      >
        <X size={20} />
      </button>
      <span className="absolute left-4 top-4 z-10 rounded-full bg-background/20 px-3 py-1 font-body text-xs font-semibold text-background">
        {label}
      </span>

      {failed ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
          <AlertTriangle size={28} className="text-background/80" />
          <p className="font-body text-sm text-background">Image could not be loaded</p>
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              setAttempt((a) => a + 1);
            }}
            className="rounded-full bg-background/20 px-4 py-2 font-body text-xs font-semibold text-background"
          >
            Retry
          </button>
        </div>
      ) : (
        <TransformWrapper minScale={1} maxScale={8} doubleClick={{ mode: "toggle" }} centerOnInit>
          <TransformComponent
            wrapperStyle={{ width: "100%", height: "100%" }}
            contentStyle={{ width: "100%", height: "100%" }}
          >
            <div className="flex h-full w-full items-center justify-center p-4">
              <img
                key={attempt}
                src={url}
                alt={`${label} analysis image full size`}
                className="max-h-full max-w-full object-contain"
                draggable={false}
                onError={() => setFailed(true)}
              />
            </div>
          </TransformComponent>
        </TransformWrapper>
      )}
    </div>,
    document.body
  );
};

export default GradingPhotosViewer;
