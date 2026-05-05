/**
 * @file GradeVinylDialog.tsx — AI-powered vinyl condition grading dialog (8-photo workflow).
 *
 * **Flow:**
 * 1. **Capture** – User uploads exactly 8 photos: 4 quarters of Side A + 4 quarters of Side B.
 *    Each photo must include the center label so the AI can confirm all photos belong to
 *    the same physical record.
 * 2. **Uploading** – Photos are uploaded to the `record-photos` bucket under a per-grading
 *    folder so they persist and can be displayed later.
 * 3. **Grading** – The `grade-vinyl` edge function sends the 8 signed image URLs to an AI
 *    model that verifies the record identity and grades scratches/scuffs/warping/chips.
 * 4. **Results** – Displays the grade, confidence, breakdown, and notes. The 8 photo URLs
 *    are saved to `grading_history.photo_urls` so they can be viewed later from the record
 *    detail sheet.
 */
import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, Star, X, ImagePlus, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import QuarterTutorial from "@/components/QuarterTutorial";

/** Props — `recordId/title/artist` are stored on the resulting history row. */
interface GradeVinylDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordId?: string;
  recordTitle?: string;
  recordArtist?: string;
}

/** Shape of the grading payload returned by the `grade-vinyl` edge function. */
interface GradingResult {
  /** Decimal condition score from 0.0 (damaged) to 10.0 (perfect), or null if undecidable. */
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

/** UI state machine: photo capture → upload → AI grading → results display. */
type Stage = "capture" | "uploading" | "grading" | "results";

/** Exact number of photos required before grading can be submitted. */
const REQUIRED_PHOTOS = 8;

/** Human-readable slot labels — index matches the slot grid order. */
const SLOT_LABELS = [
  "Side A · Q1 (top-right)",
  "Side A · Q2 (bottom-right)",
  "Side A · Q3 (bottom-left)",
  "Side A · Q4 (top-left)",
  "Side B · Q1 (top-right)",
  "Side B · Q2 (bottom-right)",
  "Side B · Q3 (bottom-left)",
  "Side B · Q4 (top-left)",
];

/** Score-to-Tailwind-color mapping for the displayed decimal score. */
const scoreColor = (score: number | null): string => {
  if (score === null) return "text-foreground";
  if (score >= 9.5) return "text-emerald-500";
  if (score >= 9.0) return "text-emerald-400";
  if (score >= 8.0) return "text-green-500";
  if (score >= 7.0) return "text-amber-500";
  if (score >= 5.5) return "text-orange-500";
  return "text-destructive";
};

/** Background tint behind the score badge. */
const scoreBackground = (score: number | null): string => {
  if (score === null) return "bg-muted";
  if (score >= 9.5) return "bg-emerald-500/15";
  if (score >= 9.0) return "bg-emerald-400/15";
  if (score >= 8.0) return "bg-green-500/15";
  if (score >= 7.0) return "bg-amber-500/15";
  if (score >= 5.5) return "bg-orange-500/15";
  return "bg-destructive/15";
};

/** Short label describing what the numeric score means. */
const scoreLabel = (score: number | null): string => {
  if (score === null) return "Unknown";
  if (score >= 9.5) return "Perfect";
  if (score >= 9.0) return "Excellent";
  if (score >= 8.0) return "Very Good";
  if (score >= 7.0) return "Good";
  if (score >= 5.5) return "Okay";
  if (score >= 3.5) return "Poor";
  return "Damaged";
};

/** Map a severity word from the AI breakdown to a Tailwind text color. */
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

/** A photo placed into one of the 8 grid slots, plus its blob preview URL. */
interface SlotPhoto {
  file: File;
  previewUrl: string;
}

const GradeVinylDialog = ({ open, onOpenChange, recordId, recordTitle, recordArtist }: GradeVinylDialogProps) => {
  const { user, session } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeSlotRef = useRef<number>(0);
  const [stage, setStage] = useState<Stage>("capture");
  const [slots, setSlots] = useState<(SlotPhoto | null)[]>(Array(REQUIRED_PHOTOS).fill(null));
  const [grading, setGrading] = useState<GradingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialSlot, setTutorialSlot] = useState<number>(0);

  const filledCount = slots.filter(Boolean).length;

  /** Reset all state and revoke any blob URLs to avoid memory leaks. */
  const reset = () => {
    slots.forEach((s) => s && URL.revokeObjectURL(s.previewUrl));
    setStage("capture");
    setSlots(Array(REQUIRED_PHOTOS).fill(null));
    setGrading(null);
    setError(null);
    setProgress(0);
  };

  /** When the dialog is closed, reset state so the next open starts fresh. */
  const handleOpenChange = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  /** Tap a slot → open the animated tutorial for that quarter. */
  const handleSlotClick = (idx: number) => {
    activeSlotRef.current = idx;
    setTutorialSlot(idx);
    setTutorialOpen(true);
  };

  /** Tutorial confirmed → close it and trigger the camera input. */
  const handleTutorialConfirm = () => {
    setTutorialOpen(false);
    // Wait for dialog close animation before opening the camera so iOS picks it up reliably
    setTimeout(() => fileInputRef.current?.click(), 150);
  };

  /**
   * File input change — validate quality (min ~150KB), max size (10MB),
   * then place the file in the currently active slot.
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Quality check: require at least 800x800 estimate via file size as a proxy (>= 200KB)
    if (file.size < 150 * 1024) {
      toast.error("Photo quality too low. Please use a clear, high-resolution image.");
      e.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Photo too large (max 10MB).");
      e.target.value = "";
      return;
    }

    const idx = activeSlotRef.current;
    setSlots((prev) => {
      const next = [...prev];
      if (next[idx]) URL.revokeObjectURL(next[idx]!.previewUrl);
      next[idx] = { file, previewUrl: URL.createObjectURL(file) };
      return next;
    });
    e.target.value = "";
  };

  /** Remove a photo from a single slot and revoke its blob URL. */
  const handleRemoveSlot = (idx: number) => {
    setSlots((prev) => {
      const next = [...prev];
      if (next[idx]) URL.revokeObjectURL(next[idx]!.previewUrl);
      next[idx] = null;
      return next;
    });
  };

  /**
   * Submit flow:
   * 1. Upload all 8 photos to `record-photos/<userId>/grading/<sessionId>/`.
   *    On any upload failure, already-uploaded photos are removed.
   * 2. Invoke the `grade-vinyl` edge function with the file paths.
   * 3. Persist the AI result + photo URLs to `grading_history` for later viewing.
   */
  const handleSubmit = async () => {
    if (!user || !session) return;
    if (filledCount < REQUIRED_PHOTOS) {
      toast.error(`Please add all ${REQUIRED_PHOTOS} photos`);
      return;
    }

    setError(null);
    setStage("uploading");
    setProgress(0);

    const sessionId = crypto.randomUUID();
    const uploadedPaths: string[] = [];
    const publicUrls: string[] = [];

    // Upload each photo sequentially so we can show progress
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]!;
      const ext = slot.file.name.split(".").pop() || "jpg";
      const path = `${user.id}/grading/${sessionId}/${i + 1}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("record-photos")
        .upload(path, slot.file, { contentType: slot.file.type, upsert: false });
      if (upErr) {
        setError("Failed to upload photo. Please try again.");
        setStage("capture");
        // Cleanup any already uploaded
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
        setError("Failed to grade record. Try clearer photos showing the playing surface and center.");
        setStage("capture");
        return;
      }

      const data = resp.data;
      if (data.error) {
        setError(data.error);
        setStage("capture");
        return;
      }

      setGrading(data.grading);
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
      } as any);
    } catch {
      setError("Something went wrong. Please try again.");
      setStage("capture");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Star size={20} className="text-primary" />
            Grade Vinyl Condition
          </DialogTitle>
        </DialogHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

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
                    Add <strong>8 high-quality photos</strong>: 4 quarters of <strong>Side A</strong> and 4 quarters of <strong>Side B</strong>.
                    Each photo <strong>must include the center label</strong> so we can confirm it's the same record.
                  </p>
                </div>

                {error && (
                  <p className="text-center font-body text-sm text-destructive px-1">{error}</p>
                )}

                {/* Side A */}
                <div>
                  <p className="font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Side A</p>
                  <div className="grid grid-cols-4 gap-2">
                    {slots.slice(0, 4).map((slot, i) => (
                      <SlotButton
                        key={i}
                        index={i}
                        slot={slot}
                        label={SLOT_LABELS[i]}
                        onClick={() => handleSlotClick(i)}
                        onRemove={() => handleRemoveSlot(i)}
                      />
                    ))}
                  </div>
                </div>

                {/* Side B */}
                <div>
                  <p className="font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Side B</p>
                  <div className="grid grid-cols-4 gap-2">
                    {slots.slice(4, 8).map((slot, i) => (
                      <SlotButton
                        key={i + 4}
                        index={i + 4}
                        slot={slot}
                        label={SLOT_LABELS[i + 4]}
                        onClick={() => handleSlotClick(i + 4)}
                        onRemove={() => handleRemoveSlot(i + 4)}
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
                className="flex flex-col items-center py-10 gap-5"
              >
                <Loader2 size={36} className="animate-spin text-primary" />
                <div className="flex flex-col items-center gap-1">
                  <p className="font-body text-sm font-medium text-foreground">
                    {stage === "uploading" ? `Uploading photos... ${progress}%` : "AI is grading your vinyl..."}
                  </p>
                  <p className="font-body text-xs text-muted-foreground">
                    {stage === "uploading"
                      ? "Sending high-quality images securely"
                      : "Verifying record identity & analyzing all 8 photos"}
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
                  <p className={`font-display text-5xl font-black ${scoreColor(grading.score)}`}>
                    {grading.score !== null ? grading.score.toFixed(1) : "?"}
                    <span className="font-display text-2xl font-bold opacity-60">/10</span>
                  </p>
                  <p className="font-display text-sm font-semibold text-foreground mt-1">{scoreLabel(grading.score)}</p>
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

                <Button variant="outline" onClick={reset} className="mt-1">
                  Grade Another Record
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>

      <QuarterTutorial
        open={tutorialOpen}
        onOpenChange={setTutorialOpen}
        slotIndex={tutorialSlot}
        onConfirm={handleTutorialConfirm}
      />
    </Dialog>
  );
};

/** One cell in the 4×2 quarter grid — empty placeholder or filled thumbnail. */
interface SlotButtonProps {
  index: number;
  slot: SlotPhoto | null;
  label: string;
  onClick: () => void;
  onRemove: () => void;
}

const SlotButton = ({ index, slot, label, onClick, onRemove }: SlotButtonProps) => {
  return (
    <div className="relative aspect-square">
      {slot ? (
        <>
          <img
            src={slot.previewUrl}
            alt={label}
            className="h-full w-full rounded-lg object-cover"
          />
          <button
            onClick={onRemove}
            type="button"
            className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
            aria-label="Remove photo"
          >
            <X size={10} />
          </button>
          <div className="absolute bottom-0.5 right-0.5 rounded-full bg-emerald-500 p-0.5">
            <CheckCircle2 size={10} className="text-white" />
          </div>
        </>
      ) : (
        <button
          onClick={onClick}
          type="button"
          className="flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed border-primary/30 text-primary transition-colors hover:border-primary/60 hover:bg-primary/5"
          aria-label={label}
        >
          <ImagePlus size={16} />
          <span className="font-body text-[9px] font-semibold">Q{(index % 4) + 1}</span>
        </button>
      )}
    </div>
  );
};

export default GradeVinylDialog;
