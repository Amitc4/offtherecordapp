/**
 * @file GradingPhotosViewer.tsx — Modal showing the original and annotated
 * grading photos for each record side.
 *
 * Each side renders a pair of thumbnails: the original photo taken by the user
 * and the overlay image returned by the analysis model with detected marks
 * highlighted. Tapping either thumbnail opens a full-screen viewer with
 * pinch-to-zoom and free panning, plus a toggle that instantly swaps between
 * the original and marked-up versions of the same side without changing the
 * viewport position — useful for quickly comparing where the model recognised
 * scratches and imperfections.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Disc3, X, AlertTriangle } from "lucide-react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { supabase } from "@/integrations/supabase/client";
import { MIN_JUDGED_PCT } from "@/config/scanner";
import { discOfSideKey, sideKeyLabel } from "@/lib/recordFormat";


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
  /** The original photo captured before analysis. */
  rawUrl?: string | null;
  grade?: string | null;
  markCount?: number | null;
  judgedPct?: number | null;
}

interface GradingPhotosViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Stored per-side results. Missing sides are rendered as empty slots. */
  sides: SideScanSummary[];
  /** Optional heading override, e.g. "Seller's grading photos". */
  title?: string;
}

const DEFAULT_SIDES = ["A", "B"];

/** Ordered side keys to render: the stored ones (disc 1 first), or A/B when empty. */
const orderedSideKeys = (sides: SideScanSummary[]): string[] => {
  const keys = Array.from(
    new Set(sides.map((s) => (s.side || "").toUpperCase()).filter(Boolean)),
  );
  if (!keys.length) return DEFAULT_SIDES;
  const rank = (k: string) => discOfSideKey(k) * 10 + (k.startsWith("B") ? 1 : 0);
  return keys.sort((a, b) => rank(a) - rank(b));
};

const GradingPhotosViewer = ({ open, onOpenChange, sides, title }: GradingPhotosViewerProps) => {
  const [zoom, setZoom] = useState<{ side: string; mode: "before" | "after" } | null>(null);

  const sideKeys = orderedSideKeys(sides);
  const bySide = sideKeys.map((s) => sides.find((x) => (x.side || "").toUpperCase() === s));

  // Flat list of every image we may show, in slot order: before, after per side.
  const slots = bySide.flatMap((s, i) => [
    { side: sideKeys[i], kind: "before" as const, url: s?.rawUrl || "" },
    { side: sideKeys[i], kind: "after" as const, url: s?.overlayUrl || "" },
  ]);
  const present = slots.filter((s) => s.url).map((s) => s.url);
  const signed = useSignedUrls(present, open);

  let cursor = 0;
  const displayUrls = slots.map((s) => (s.url ? (signed ? signed[cursor++] || s.url : "") : ""));

  const loading = signed === null && present.length > 0;
  const count = present.length;

  // Resolve the signed before/after URLs for the currently zoomed side.
  const zoomIndex = zoom ? sideKeys.indexOf(zoom.side) : -1;
  const zoomBeforeUrl = zoomIndex >= 0 ? displayUrls[zoomIndex * 2] : "";
  const zoomAfterUrl = zoomIndex >= 0 ? displayUrls[zoomIndex * 2 + 1] : "";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Disc3 size={18} className="text-primary" />
              {title || "Grading photos"} ({count})
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {sideKeys.map((side, i) => (
              <SideBlock
                key={side}
                side={sideKeyLabel(side)}
                beforeUrl={displayUrls[i * 2]}
                afterUrl={displayUrls[i * 2 + 1]}
                hasBefore={!!slots[i * 2].url}
                hasAfter={!!slots[i * 2 + 1].url}
                loading={loading}
                scan={bySide[i]}
                onOpen={(mode) => setZoom({ side, mode })}
              />
            ))}
          </div>


        </DialogContent>
      </Dialog>

      {zoom && (
        <ZoomViewer
          side={zoom.side}
          mode={zoom.mode}
          beforeUrl={zoomBeforeUrl}
          afterUrl={zoomAfterUrl}
          onToggle={() =>
            setZoom((z) => (z ? { ...z, mode: z.mode === "before" ? "after" : "before" } : null))
          }
          onClose={() => setZoom(null)}
        />
      )}
    </>
  );
};

/** A single thumbnail with its own loading / failure handling. */
const Thumb = ({
  url,
  hasImage,
  loading,
  label,
  alt,
  onOpen,
}: {
  url?: string;
  hasImage?: boolean;
  loading?: boolean;
  label: string;
  alt: string;
  onOpen: () => void;
}) => {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // A new source is a fresh chance: never keep a stale failure flag.
  useEffect(() => {
    setFailed(false);
  }, [url]);

  return (
    <div className="flex-1">
      <p className="mb-1 font-body text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {!hasImage ? (
        <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-muted">
          <Disc3 size={18} className="text-muted-foreground" />
        </div>
      ) : !url || loading ? (
        <div className="aspect-square w-full animate-pulse rounded-lg bg-muted" />
      ) : failed ? (
        <div className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg bg-muted p-2 text-center">
          <p className="font-body text-[10px] leading-tight text-muted-foreground">
            Image could not be loaded
          </p>
          <button
            type="button"
            onClick={() => {
              setFailed(false);
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
          className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted"
          aria-label={`View ${alt} full screen`}
        >
          <img
            key={attempt}
            src={url}
            alt={alt}
            className="h-full w-full object-cover transition-transform active:scale-95"
            onError={() => setFailed(true)}
          />
        </button>
      )}
    </div>
  );
};

/** One side: heading, before/after thumbnails and the stored result. */
const SideBlock = ({
  side,
  beforeUrl,
  afterUrl,
  hasBefore,
  hasAfter,
  loading,
  scan,
  onOpen,
}: {
  side: string;
  beforeUrl?: string;
  afterUrl?: string;
  hasBefore?: boolean;
  hasAfter?: boolean;
  loading?: boolean;
  scan?: SideScanSummary;
  onOpen: (mode: "before" | "after") => void;
}) => {
  const judged = scan?.judgedPct;
  const lowCoverage = typeof judged === "number" && judged < MIN_JUDGED_PCT;

  if (!hasBefore && !hasAfter) {
    return (
      <div>
        <p className="font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          {side}
        </p>
        <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Disc3 size={20} className="text-muted-foreground" />
          </div>
          <p className="font-body text-xs text-muted-foreground">Not graded yet</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        {side}
      </p>

      <div className="flex gap-3">
        <Thumb
          url={beforeUrl}
          hasImage={hasBefore}
          loading={loading}
          label="Before grading"
          alt={`original photo of ${side}`}
          onOpen={() => beforeUrl && onOpen("before")}
        />
        <Thumb
          url={afterUrl}
          hasImage={hasAfter}
          loading={loading}
          label="After grading"
          alt={`detected marks on ${side}`}
          onOpen={() => afterUrl && onOpen("after")}
        />
      </div>

      <div className="mt-2 space-y-1">
        <p className="font-display text-sm font-bold text-foreground">{scan?.grade || "—"}</p>
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
 * A top-centre toggle swaps between the original photo and the model's
 * annotated overlay for the same record side without remounting the zoom
 * wrapper, so the current pan/zoom position is preserved and the user can
 * rapidly flip back and forth to compare imperfections.
 */
const ZoomViewer = ({
  side,
  mode,
  beforeUrl,
  afterUrl,
  onToggle,
  onClose,
}: {
  side: string;
  mode: "before" | "after";
  beforeUrl: string;
  afterUrl: string;
  onToggle: () => void;
  onClose: () => void;
}) => {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const url = mode === "before" ? beforeUrl : afterUrl;
  const label = `${sideKeyLabel(side)} — ${mode === "before" ? "before grading" : "detected marks"}`;
  const canToggle = !!beforeUrl && !!afterUrl;
  const toggleLabel = mode === "before" ? "Show marks" : "Show original";

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

  // Reset the failure flag when the active source changes so a transient error
  // on one image does not persist after toggling.
  useEffect(() => {
    setFailed(false);
  }, [url]);

  return createPortal(
    <div
      className="pointer-events-auto fixed inset-0 z-[200] bg-foreground/95"
      style={{ touchAction: "none" }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="pointer-events-auto absolute right-3 top-3 z-[210] flex h-11 w-11 items-center justify-center rounded-full bg-background/25 text-background active:bg-background/40"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onPointerUp={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        aria-label="Close"
      >
        <X size={22} />
      </button>
      <span className="pointer-events-none absolute left-4 top-4 z-[210] rounded-full bg-background/20 px-3 py-1 font-body text-xs font-semibold text-background">
        {label}
      </span>

      {canToggle && (
        <button
          type="button"
          className="pointer-events-auto absolute left-1/2 top-3 z-[210] -translate-x-1/2 rounded-full bg-background/25 px-4 py-2 font-body text-xs font-semibold text-background active:bg-background/40"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggle();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          aria-label={toggleLabel}
        >
          {toggleLabel}
        </button>
      )}


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
