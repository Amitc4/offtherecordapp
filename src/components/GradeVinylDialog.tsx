/**
 * @file GradeVinylDialog.tsx — AI-powered vinyl condition grading dialog (2-photo workflow).
 *
 * **Flow:**
 *   User uploads 2 photos:
 *     0. Side A — Full disc (frame the whole record inside the circular guide)
 *     1. Side B — Full disc
 *
 *   After grading succeeds, the app automatically generates 2 additional
 *   "macro" images by cropping the center-label region from each full-disc
 *   photo. The 4 resulting images (2 originals + 2 auto-cropped macros) are
 *   attached to the record's photo gallery.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, Star, X, CheckCircle2, Images } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import GradingPhotosViewer, { type PhotoDefect } from "@/components/GradingPhotosViewer";
import CameraCapture, { type CaptureMode } from "@/components/CameraCapture";

interface GradeVinylDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordId?: string;
  recordTitle?: string;
  recordArtist?: string;
}

interface GradingResult {
  score: number | null;
  confidence: number;
  summary: string;
  details: {
    scratches: string;
    scuffs: string;
    warping: string;
    chips: string;
    surface_noise_estimate: string;
  };
  notes: string;
}

type Stage = "capture" | "uploading" | "grading" | "results";

const REQUIRED_PHOTOS = 2;

interface SlotSpec {
  label: string;
  short: string;
  mode: CaptureMode;
  hint: string;
}

/** Slot definitions — order matches the array indices sent to the edge fn. */
const SLOTS: SlotSpec[] = [
  {
    label: "Side A — Full disc",
    short: "Side A",
    mode: "full",
    hint: "Fit the whole record inside the circle. Include the center label.",
  },
  {
    label: "Side B — Full disc",
    short: "Side B",
    mode: "full",
    hint: "Flip the record. Fit the whole disc inside the circle.",
  },
];

/**
 * Crop the center label region from a full-disc photo. The label sits at the
 * geometric center of the disc; we extract a square that's ~38% of the shorter
 * side, then upscale to a clean 800px square for the macro view.
 */
async function generateMacroCrop(sourceFile: File): Promise<File> {
  const bitmap = await createImageBitmap(sourceFile);
  const side = Math.min(bitmap.width, bitmap.height);
  const cropSize = Math.round(side * 0.38);
  const sx = Math.round((bitmap.width - cropSize) / 2);
  const sy = Math.round((bitmap.height - cropSize) / 2);

  const out = 800;
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, cropSize, cropSize, 0, 0, out, out);
  bitmap.close?.();

  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.92)
  );
  return new File([blob], `macro-${Date.now()}.jpg`, { type: "image/jpeg" });
}

const scoreColor = (score: number | null): string => {
  if (score === null) return "text-foreground";
  if (score >= 9.5) return "text-emerald-500";
  if (score >= 9.0) return "text-emerald-400";
  if (score >= 8.0) return "text-green-500";
  if (score >= 7.0) return "text-amber-500";
  if (score >= 5.5) return "text-orange-500";
  return "text-destructive";
};

const scoreBackground = (score: number | null): string => {
  if (score === null) return "bg-muted";
  if (score >= 9.5) return "bg-emerald-500/15";
  if (score >= 9.0) return "bg-emerald-400/15";
  if (score >= 8.0) return "bg-green-500/15";
  if (score >= 7.0) return "bg-amber-500/15";
  if (score >= 5.5) return "bg-orange-500/15";
  return "bg-destructive/15";
};

const goldmineGrade = (score: number | null): string => {
  if (score === null) return "—";
  if (score >= 9.8) return "M";
  if (score >= 9.0) return "NM";
  if (score >= 7.5) return "VG+";
  if (score >= 6.0) return "VG";
  if (score >= 4.0) return "G+";
  if (score >= 2.5) return "G";
  return "F";
};

const scoreLabel = (score: number | null): string => {
  if (score === null) return "Unknown";
  if (score >= 9.8) return "Mint";
  if (score >= 9.0) return "Near Mint";
  if (score >= 7.5) return "Very Good Plus";
  if (score >= 6.0) return "Very Good";
  if (score >= 4.0) return "Good Plus";
  if (score >= 2.5) return "Good";
  return "Fair";
};

const severityColor = (level: string) => {
  switch (level) {
    case "none": return "text-emerald-500";
    case "light":
    case "slight":
    case "minor":
    case "minimal": return "text-amber-500";
    case "moderate": return "text-orange-500";
    default: return "text-destructive";
  }
};

interface SlotPhoto {
  file: File;
  previewUrl: string;
}

const GradeVinylDialog = ({ open, onOpenChange, recordId, recordTitle, recordArtist }: GradeVinylDialogProps) => {
  const { user, session } = useAuth();
  const [stage, setStage] = useState<Stage>("capture");
  const [slots, setSlots] = useState<(SlotPhoto | null)[]>(Array(REQUIRED_PHOTOS).fill(null));
  const [grading, setGrading] = useState<GradingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [resultPhotoUrls, setResultPhotoUrls] = useState<string[]>([]);
  const [resultDefects, setResultDefects] = useState<PhotoDefect[][]>([]);
  const [photosViewerOpen, setPhotosViewerOpen] = useState(false);
  const [badIndices, setBadIndices] = useState<number[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [activeSlot, setActiveSlot] = useState<number>(0);

  const filledCount = slots.filter(Boolean).length;

  const reset = () => {
    slots.forEach((s) => s && URL.revokeObjectURL(s.previewUrl));
    setStage("capture");
    setSlots(Array(REQUIRED_PHOTOS).fill(null));
    setGrading(null);
    setError(null);
    setProgress(0);
    setResultPhotoUrls([]);
    setResultDefects([]);
    setBadIndices([]);
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const openCameraFor = (idx: number) => {
    setActiveSlot(idx);
    setCameraOpen(true);
  };

  const handleCapture = (file: File) => {
    const idx = activeSlot;
    setSlots((prev) => {
      const next = [...prev];
      if (next[idx]) URL.revokeObjectURL(next[idx]!.previewUrl);
      next[idx] = { file, previewUrl: URL.createObjectURL(file) };
      return next;
    });
    setBadIndices((prev) => prev.filter((i) => i !== idx));
  };

  const handleRemoveSlot = (idx: number) => {
    setSlots((prev) => {
      const next = [...prev];
      if (next[idx]) URL.revokeObjectURL(next[idx]!.previewUrl);
      next[idx] = null;
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!user || !session) return;
    if (filledCount < REQUIRED_PHOTOS) {
      toast.error(`Please add all ${REQUIRED_PHOTOS} photos`);
      return;
    }

    setError(null);
    setBadIndices([]);
    setStage("uploading");
    setProgress(0);

    const sessionId = crypto.randomUUID();
    const uploadedPaths: string[] = [];
    const publicUrls: string[] = [];

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]!;
      const ext = (slot.file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/grading/${sessionId}/${i + 1}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("record-photos")
        .upload(path, slot.file, { contentType: slot.file.type || "image/jpeg", upsert: false });
      if (upErr) {
        setError("Failed to upload photo. Please try again.");
        setStage("capture");
        if (uploadedPaths.length) {
          await supabase.storage.from("record-photos").remove(uploadedPaths);
        }
        return;
      }
      uploadedPaths.push(path);
      const { data: pub } = supabase.storage.from("record-photos").getPublicUrl(path);
      publicUrls.push(pub.publicUrl);
      setProgress(Math.round(((i + 1) / slots.length) * 100));
    }

    setStage("grading");
    try {
      const resp = await supabase.functions.invoke("grade-vinyl", {
        body: { file_paths: uploadedPaths },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (resp.error) {
        setError("Failed to grade record. Try clearer photos.");
        setStage("capture");
        return;
      }

      const data = resp.data;
      if (data.error) {
        setError(data.error);
        if (Array.isArray(data.bad_photo_indices)) setBadIndices(data.bad_photo_indices);
        setStage("capture");
        return;
      }

      const bad: number[] = Array.isArray(data.grading?.bad_photo_indices)
        ? data.grading.bad_photo_indices
        : [];
      if (data.grading?.score === null || bad.length > 0) {
        setBadIndices(bad.length > 0 ? bad : slots.map((_, i) => i));
        setError(
          data.grading?.summary ||
            "Some photos couldn't be used. Please retake the highlighted ones."
        );
        setStage("capture");
        return;
      }

      setGrading(data.grading);
      const defects: PhotoDefect[][] = Array.isArray(data.grading?.defects_per_photo)
        ? data.grading.defects_per_photo
        : [];
      setResultPhotoUrls(publicUrls);
      setResultDefects(defects);
      setStage("results");

      await supabase.from("grading_history").insert({
        user_id: user.id,
        record_id: recordId || null,
        record_title: recordTitle || null,
        record_artist: recordArtist || null,
        score: data.grading.score,
        grade_label: scoreLabel(data.grading.score),
        confidence: data.grading.confidence,
        summary: data.grading.summary,
        details: data.grading.details,
        notes: data.grading.notes,
        photo_urls: publicUrls,
        defects: defects,
      } as any);

      // Attach the 4 photos directly to the record so they show up in the
      // record's photo gallery (Collection tab). Max is 4 in the schema, so
      // clear any existing rows first to avoid the limit tripping.
      if (recordId) {
        await supabase.from("record_photos").delete().eq("record_id", recordId);
        const rows = publicUrls.map((url) => ({ record_id: recordId, photo_url: url }));
        await supabase.from("record_photos").insert(rows as any);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setStage("capture");
    }
  };

  const activeSpec = SLOTS[activeSlot];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Star size={20} className="text-primary" />
            Grade Vinyl Condition
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {stage === "capture" && (
              <motion.div
                key="capture"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-4 py-2"
              >
                <div className="rounded-xl bg-primary/10 p-3">
                  <p className="font-body text-xs text-foreground">
                    Take <strong>4 photos</strong>: full shots of <strong>Side A</strong> and <strong>Side B</strong>,
                    plus close-up macro shots of each center label. A circular guide will appear in the camera to
                    help you frame the disc.
                  </p>
                </div>

                {error && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
                    <p className="font-body text-xs text-destructive">{error}</p>
                    {badIndices.length > 0 && (
                      <p className="font-body text-[11px] text-destructive/80 mt-1">
                        Tap the highlighted {badIndices.length === 1 ? "photo" : "photos"} to retake.
                      </p>
                    )}
                  </div>
                )}

                {/* Full disc row */}
                <div>
                  <p className="font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Full disc
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[0, 1].map((i) => (
                      <SlotButton
                        key={i}
                        spec={SLOTS[i]}
                        slot={slots[i]}
                        needsRetake={badIndices.includes(i)}
                        onClick={() => openCameraFor(i)}
                        onRemove={() => handleRemoveSlot(i)}
                      />
                    ))}
                  </div>
                </div>

                {/* Macro row */}
                <div>
                  <p className="font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Macro (center label)
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[2, 3].map((i) => (
                      <SlotButton
                        key={i}
                        spec={SLOTS[i]}
                        slot={slots[i]}
                        needsRetake={badIndices.includes(i)}
                        onClick={() => openCameraFor(i)}
                        onRemove={() => handleRemoveSlot(i)}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <p className="font-body text-xs text-muted-foreground">
                    {filledCount}/{REQUIRED_PHOTOS} photos
                  </p>
                  {filledCount > 0 && (
                    <button
                      onClick={() => {
                        slots.forEach((s) => s && URL.revokeObjectURL(s.previewUrl));
                        setSlots(Array(REQUIRED_PHOTOS).fill(null));
                      }}
                      className="font-body text-xs text-muted-foreground hover:text-destructive"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={filledCount < REQUIRED_PHOTOS}
                  className="gap-2"
                >
                  <Star size={16} />
                  Grade Record
                </Button>
              </motion.div>
            )}

            {(stage === "uploading" || stage === "grading") && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center py-6 gap-5"
              >
                {stage === "grading" && slots[0]?.previewUrl ? (
                  <div className="relative w-48 h-48 rounded-xl overflow-hidden border border-primary/30 shadow-lg">
                    <img src={slots[0].previewUrl} alt="Scanning" className="h-full w-full object-cover" />
                    <motion.div
                      className="absolute inset-x-0 h-1 bg-primary shadow-[0_0_12px_3px_hsl(var(--primary))]"
                      initial={{ top: "0%" }}
                      animate={{ top: ["0%", "100%", "0%"] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
                    />
                    <div className="absolute inset-0 ring-1 ring-primary/50 rounded-xl" />
                  </div>
                ) : (
                  <Loader2 size={36} className="animate-spin text-primary" />
                )}
                <div className="flex flex-col items-center gap-1">
                  <p className="font-body text-sm font-medium text-foreground">
                    {stage === "uploading" ? `Uploading photos... ${progress}%` : "Analyzing surface integrity..."}
                  </p>
                  <p className="font-body text-xs text-muted-foreground text-center px-4">
                    {stage === "uploading"
                      ? "Sending high-quality images securely"
                      : "Filtering reflections, mapping groove wear across both sides"}
                  </p>
                </div>
                {stage === "uploading" && (
                  <div className="w-full max-w-xs h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </motion.div>
            )}

            {stage === "results" && grading && (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-4 pb-2"
              >
                <div className={`rounded-xl p-5 text-center ${scoreBackground(grading.score)}`}>
                  <p className={`font-display text-6xl font-black leading-none ${scoreColor(grading.score)}`}>
                    {goldmineGrade(grading.score)}
                  </p>
                  <p className="font-display text-sm font-semibold text-foreground mt-2">
                    {scoreLabel(grading.score)}
                  </p>
                  <p className={`font-display text-2xl font-bold mt-2 ${scoreColor(grading.score)}`}>
                    {grading.score !== null ? grading.score.toFixed(1) : "?"}
                    <span className="text-base font-bold opacity-60">/10</span>
                  </p>
                  <p className="font-body text-xs text-muted-foreground mt-1">
                    {grading.confidence}% confidence
                  </p>
                </div>

                <div className="rounded-xl bg-card p-4">
                  <p className="font-body text-sm text-foreground">{grading.summary}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Scratches", value: grading.details.scratches },
                    { label: "Scuffs", value: grading.details.scuffs },
                    { label: "Warping", value: grading.details.warping },
                    { label: "Chips", value: grading.details.chips },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg bg-card p-3">
                      <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wide">{item.label}</p>
                      <p className={`font-body text-sm font-semibold capitalize ${severityColor(item.value)}`}>
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg bg-card p-3">
                  <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wide">Est. Surface Noise</p>
                  <p className={`font-body text-sm font-semibold capitalize ${severityColor(grading.details.surface_noise_estimate)}`}>
                    {grading.details.surface_noise_estimate}
                  </p>
                </div>

                {grading.notes && (
                  <div className="rounded-xl bg-card p-4">
                    <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
                    <p className="font-body text-xs text-foreground">{grading.notes}</p>
                  </div>
                )}

                {resultPhotoUrls.length > 0 && (
                  <Button
                    variant="secondary"
                    onClick={() => setPhotosViewerOpen(true)}
                    className="gap-2"
                  >
                    <Images size={16} />
                    View Photos & Imperfections
                  </Button>
                )}

                <Button variant="outline" onClick={reset} className="mt-1">
                  Grade Another Record
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>

      <GradingPhotosViewer
        open={photosViewerOpen}
        onOpenChange={setPhotosViewerOpen}
        photoUrls={resultPhotoUrls}
        defectsPerPhoto={resultDefects}
      />

      <CameraCapture
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        mode={activeSpec.mode}
        title={activeSpec.label}
        hint={activeSpec.hint}
        onCapture={handleCapture}
      />
    </Dialog>
  );
};

interface SlotButtonProps {
  spec: SlotSpec;
  slot: SlotPhoto | null;
  needsRetake?: boolean;
  onClick: () => void;
  onRemove: () => void;
}

const SlotButton = ({ spec, slot, needsRetake, onClick, onRemove }: SlotButtonProps) => {
  return (
    <div className="relative aspect-square">
      {slot ? (
        <>
          <button
            type="button"
            onClick={needsRetake ? onClick : undefined}
            className={`block h-full w-full overflow-hidden rounded-lg ${
              needsRetake ? "ring-2 ring-destructive ring-offset-1 ring-offset-background animate-pulse" : ""
            }`}
            aria-label={needsRetake ? `Retake ${spec.label}` : spec.label}
          >
            <img src={slot.previewUrl} alt={spec.label} className="h-full w-full object-cover" />
          </button>
          <button
            onClick={onRemove}
            type="button"
            className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
            aria-label="Remove photo"
          >
            <X size={10} />
          </button>
          {needsRetake ? (
            <div className="absolute inset-x-0 bottom-0 rounded-b-lg bg-destructive/90 py-0.5 text-center">
              <span className="font-body text-[9px] font-semibold text-destructive-foreground">Retake</span>
            </div>
          ) : (
            <>
              <div className="absolute bottom-0.5 right-0.5 rounded-full bg-emerald-500 p-0.5">
                <CheckCircle2 size={10} className="text-white" />
              </div>
              <div className="absolute inset-x-0 bottom-0 rounded-b-lg bg-black/60 py-0.5 text-center">
                <span className="font-body text-[9px] font-semibold text-white">{spec.short}</span>
              </div>
            </>
          )}
        </>
      ) : (
        <button
          onClick={onClick}
          type="button"
          className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-primary/30 text-primary transition-colors hover:border-primary/60 hover:bg-primary/5"
          aria-label={spec.label}
        >
          <Camera size={20} />
          <span className="font-body text-[10px] font-semibold text-center px-1 leading-tight">
            {spec.short}
          </span>
        </button>
      )}
    </div>
  );
};

export default GradeVinylDialog;
