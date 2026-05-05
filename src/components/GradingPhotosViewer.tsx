/**
 * @file GradingPhotosViewer.tsx — Modal that displays the 8 quarter photos used for an
 * AI grading of a record. Photos are shown in a 4×2 grid (Side A on top, Side B below)
 * with the quarter labels. Tap any photo to view it full-screen.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Disc3, X } from "lucide-react";

interface GradingPhotosViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photoUrls: string[];
}

const SLOT_LABELS = [
  "A · Q1", "A · Q2", "A · Q3", "A · Q4",
  "B · Q1", "B · Q2", "B · Q3", "B · Q4",
];

const GradingPhotosViewer = ({ open, onOpenChange, photoUrls }: GradingPhotosViewerProps) => {
  const [zoom, setZoom] = useState<string | null>(null);

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
              <div>
                <p className="font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Side A
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {photoUrls.slice(0, 4).map((url, i) => (
                    <PhotoTile key={i} url={url} label={SLOT_LABELS[i]} onClick={() => setZoom(url)} />
                  ))}
                </div>
              </div>

              {photoUrls.length > 4 && (
                <div>
                  <p className="font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Side B
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {photoUrls.slice(4, 8).map((url, i) => (
                      <PhotoTile key={i + 4} url={url} label={SLOT_LABELS[i + 4]} onClick={() => setZoom(url)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {zoom && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setZoom(null)}
        >
          <button
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white"
            onClick={() => setZoom(null)}
            aria-label="Close"
          >
            <X size={20} />
          </button>
          <img
            src={zoom}
            alt="Vinyl grading photo full size"
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};

const PhotoTile = ({ url, label, onClick }: { url: string; label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    type="button"
    className="group relative aspect-square overflow-hidden rounded-lg bg-muted"
  >
    <img src={url} alt={label} className="h-full w-full object-cover transition-transform group-active:scale-95" />
    <span className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 py-0.5 font-body text-[9px] font-semibold text-white">
      {label}
    </span>
  </button>
);

export default GradingPhotosViewer;
