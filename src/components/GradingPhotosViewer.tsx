/**
 * @file GradingPhotosViewer.tsx — Modal that displays the 8 quarter photos used for an
 * AI grading of a record, with optional defect markers overlayed on each photo.
 *
 * Photos are shown in a 4×2 grid (Side A on top, Side B below) with quarter labels.
 * Tap any photo to open a full-screen lightbox with the same defect markers drawn on
 * top. A toggle lets the user show/hide markers. Tapping a marker reveals a tooltip
 * with the defect's description and severity.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Disc3, X, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * The grading photos are stored in the private `record-photos` bucket. The
 * URLs persisted in `grading_history.photo_urls` are the (non-working) public
 * URLs returned by `getPublicUrl`. To actually display them we extract the
 * object path and request short-lived signed URLs.
 */
const BUCKET = "record-photos";
const extractPath = (url: string): string | null => {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
};

const useSignedPhotoUrls = (urls: string[], open: boolean): string[] => {
  const [signed, setSigned] = useState<string[]>(urls);
  useEffect(() => {
    if (!open || urls.length === 0) {
      setSigned(urls);
      return;
    }
    const paths = urls.map(extractPath);
    if (paths.every((p) => p === null)) {
      setSigned(urls);
      return;
    }
    let cancelled = false;
    (async () => {
      const validPaths = paths.filter((p): p is string => !!p);
      const { data } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(validPaths, 3600);
      if (cancelled) return;
      const map = new Map<string, string>();
      data?.forEach((d, i) => {
        if (d.signedUrl) map.set(validPaths[i], d.signedUrl);
      });
      setSigned(
        urls.map((u, i) => {
          const p = paths[i];
          return (p && map.get(p)) || u;
        })
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [open, urls.join("|")]);
  return signed;
};

/** Single AI-detected defect on a photo. Coordinates are normalized 0–1. */
export interface PhotoDefect {
  x: number;
  y: number;
  radius: number;
  type?: string;
  severity?: string;
  description?: string;
}

/** Props for the grading-photos viewer. */
interface GradingPhotosViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Public URLs of the 8 quarter photos (Side A Q1-Q4 then Side B Q1-Q4). */
  photoUrls: string[];
  /** Optional defects per photo, aligned by index with `photoUrls`. */
  defectsPerPhoto?: PhotoDefect[][];
}

/** Short label rendered on each thumbnail tile. Index matches `photoUrls`. */
const SLOT_LABELS = [
  "A · Q1", "A · Q2", "A · Q3", "A · Q4",
  "B · Q1", "B · Q2", "B · Q3", "B · Q4",
];

/** Map a severity word to a Tailwind color used for the marker ring. */
const severityRing = (sev?: string) => {
  switch ((sev || "").toLowerCase()) {
    case "none": return "border-emerald-400 bg-emerald-400/20";
    case "light":
    case "slight":
    case "minor":
    case "minimal": return "border-amber-400 bg-amber-400/25";
    case "moderate": return "border-orange-500 bg-orange-500/25";
    default: return "border-red-500 bg-red-500/25";
  }
};

const GradingPhotosViewer = ({ open, onOpenChange, photoUrls, defectsPerPhoto }: GradingPhotosViewerProps) => {
  /** Index of the photo open in the lightbox, or null. */
  const [zoomIdx, setZoomIdx] = useState<number | null>(null);
  /** Whether to draw defect markers (both in grid and lightbox). */
  const [showMarkers, setShowMarkers] = useState(true);

  const totalDefects = (defectsPerPhoto || []).reduce((n, arr) => n + (arr?.length || 0), 0);
  const displayUrls = useSignedPhotoUrls(photoUrls, open);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Disc3 size={18} className="text-primary" />
              Grading Photos ({photoUrls.length}/8)
            </DialogTitle>
          </DialogHeader>

          {photoUrls.length === 0 ? (
            <p className="py-8 text-center font-body text-sm text-muted-foreground">
              No grading photos available for this record.
            </p>
          ) : (
            <div className="space-y-4">
              {totalDefects > 0 && (
                <button
                  type="button"
                  onClick={() => setShowMarkers((v) => !v)}
                  className="flex w-full items-center justify-between rounded-lg bg-primary/10 px-3 py-2 text-primary"
                >
                  <span className="flex items-center gap-2 font-body text-xs font-semibold">
                    {showMarkers ? <Eye size={14} /> : <EyeOff size={14} />}
                    {showMarkers ? "Hide" : "Show"} defect markers
                  </span>
                  <span className="font-body text-[10px] opacity-80">
                    {totalDefects} found
                  </span>
                </button>
              )}

              <PhotoSection
                title="Side A"
                offset={0}
                photos={photoUrls.slice(0, 4)}
                defects={defectsPerPhoto?.slice(0, 4)}
                showMarkers={showMarkers}
                onTile={(i) => setZoomIdx(i)}
              />

              {photoUrls.length > 4 && (
                <PhotoSection
                  title="Side B"
                  offset={4}
                  photos={photoUrls.slice(4, 8)}
                  defects={defectsPerPhoto?.slice(4, 8)}
                  showMarkers={showMarkers}
                  onTile={(i) => setZoomIdx(i + 4)}
                />
              )}

              {totalDefects === 0 && defectsPerPhoto && (
                <p className="text-center font-body text-xs text-muted-foreground">
                  No visible defects detected by AI.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {zoomIdx !== null && photoUrls[zoomIdx] && (
        <Lightbox
          url={photoUrls[zoomIdx]}
          label={SLOT_LABELS[zoomIdx]}
          defects={showMarkers ? defectsPerPhoto?.[zoomIdx] : undefined}
          onClose={() => setZoomIdx(null)}
        />
      )}
    </>
  );
};

/** Group of 4 photos for one side, with quarter labels. */
const PhotoSection = ({
  title, offset, photos, defects, showMarkers, onTile,
}: {
  title: string;
  offset: number;
  photos: string[];
  defects?: PhotoDefect[][];
  showMarkers: boolean;
  onTile: (i: number) => void;
}) => (
  <div>
    <p className="font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
      {title}
    </p>
    <div className="grid grid-cols-4 gap-2">
      {photos.map((url, i) => (
        <PhotoTile
          key={i}
          url={url}
          label={SLOT_LABELS[offset + i]}
          defects={showMarkers ? defects?.[i] : undefined}
          onClick={() => onTile(i)}
        />
      ))}
    </div>
  </div>
);

/** Single photo thumbnail with optional defect marker overlays. */
const PhotoTile = ({
  url, label, defects, onClick,
}: {
  url: string;
  label: string;
  defects?: PhotoDefect[];
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    type="button"
    className="group relative aspect-square overflow-hidden rounded-lg bg-muted"
  >
    <img src={url} alt={label} className="h-full w-full object-cover transition-transform group-active:scale-95" />
    {defects?.map((d, i) => (
      <span
        key={i}
        className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${severityRing(d.severity)} animate-pulse`}
        style={{
          left: `${Math.max(0, Math.min(1, d.x)) * 100}%`,
          top: `${Math.max(0, Math.min(1, d.y)) * 100}%`,
          width: `${Math.max(0.02, Math.min(0.4, d.radius)) * 100}%`,
          height: `${Math.max(0.02, Math.min(0.4, d.radius)) * 100}%`,
        }}
      />
    ))}
    <span className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 py-0.5 font-body text-[9px] font-semibold text-white">
      {label}
    </span>
    {defects && defects.length > 0 && (
      <span className="absolute top-0.5 right-0.5 rounded-full bg-amber-500 px-1.5 py-0.5 font-body text-[9px] font-bold text-white">
        {defects.length}
      </span>
    )}
  </button>
);

/** Full-screen lightbox with defect markers and tap-for-detail tooltips. */
const Lightbox = ({
  url, label, defects, onClose,
}: {
  url: string;
  label: string;
  defects?: PhotoDefect[];
  onClose: () => void;
}) => {
  const [activeDefect, setActiveDefect] = useState<number | null>(null);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 z-10 rounded-full bg-white/10 p-2 text-white"
        onClick={onClose}
        aria-label="Close"
      >
        <X size={20} />
      </button>
      <span className="absolute top-4 left-4 z-10 rounded-full bg-white/10 px-3 py-1 font-body text-xs font-semibold text-white">
        {label}
      </span>

      <div
        className="relative max-h-full max-w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={url}
          alt="Vinyl grading photo full size"
          className="max-h-[85vh] max-w-full rounded-lg object-contain"
        />
        {defects?.map((d, i) => (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveDefect(activeDefect === i ? null : i);
            }}
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${severityRing(d.severity)} ${activeDefect === i ? "ring-2 ring-white" : "animate-pulse"}`}
            style={{
              left: `${Math.max(0, Math.min(1, d.x)) * 100}%`,
              top: `${Math.max(0, Math.min(1, d.y)) * 100}%`,
              width: `${Math.max(0.02, Math.min(0.4, d.radius)) * 100}%`,
              height: `${Math.max(0.02, Math.min(0.4, d.radius)) * 100}%`,
            }}
            aria-label={d.description || d.type || "defect"}
          />
        ))}

        {activeDefect !== null && defects?.[activeDefect] && (
          <div
            className="absolute bottom-3 left-3 right-3 rounded-lg bg-black/80 p-3 text-white backdrop-blur"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-display text-xs font-bold uppercase tracking-wide">
              {defects[activeDefect].type || "Imperfection"}
              {defects[activeDefect].severity && (
                <span className="ml-2 font-body text-[10px] font-medium opacity-75">
                  · {defects[activeDefect].severity}
                </span>
              )}
            </p>
            {defects[activeDefect].description && (
              <p className="mt-1 font-body text-xs opacity-90">
                {defects[activeDefect].description}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GradingPhotosViewer;
