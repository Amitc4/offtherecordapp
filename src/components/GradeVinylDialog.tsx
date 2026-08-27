/**
 * @file GradeVinylDialog.tsx — Vinyl surface grading dialog (4-photo workflow).
 *
 * **Flow:**
 *   1. The user adds 4 photos: Side A1, Side A2, Side B1 and Side B2 (two angles per side).
 *   2. "Grade Record" sends each angle to the external surface-analysis API as a
 *      separate `multipart/form-data` request (see `src/lib/scannerApi.ts`).
 *      Each angle is analysed independently — if one fails the others are still shown.
 *   3. Results show a suggested overall grade (the worse of the four angles) plus a
 *      card per angle with the detection overlay, mark list, coverage and warnings.
 *   4. In the background the photos (plus auto-generated centre-label macro crops)
 *      are uploaded to storage and attached to the record, and each angle's
 *      analysis is persisted to `record_surface_scans` for later review.
 */
import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, Star, X, CheckCircle2, ImageIcon, FileUp, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import CameraCapture, { type CaptureMode, type CaptureMeta } from "@/components/CameraCapture";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import ScanSideResultCard from "@/components/ScanSideResultCard";
import PhotoLightbox from "@/components/PhotoLightbox";
import {
  analyzeRecord,
  formatGrade,
  gradeCode,
  wakeScanner,
  worstGrade,
  type SideResult,
} from "@/lib/scannerApi";
import { SCANNER_COLD_START_NOTICE, SCANNER_MAX_PHOTO_BYTES } from "@/config/scanner";
import { sideKey } from "@/lib/recordFormat";


interface GradeVinylDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordId?: string;
  recordTitle?: string;
  recordArtist?: string;
  /** Which disc of the set is being graded (1-based). Defaults to 1. */
  disc?: number;
  /** Total discs in the set — >1 switches the copy to per-disc wording. */
  discTotal?: number;
}

type Stage = "capture" | "results";

const REQUIRED_PHOTOS = 4;

interface SlotSpec {
  label: string;
  short: string;
  side: string;
  mode: CaptureMode;
  hint: string;
}

/** Slot definitions for one disc — Side A and Side B, each from two angles. */
const slotsForDisc = (disc: number, discTotal: number): SlotSpec[] => {
  const prefix = discTotal > 1 ? `Disc ${disc} · ` : "";
  return [
    {
      label: `${prefix}Side A1 — Full disc`,
      short: `${prefix}Side A1`,
      side: sideKey(disc, "A", 1),
      mode: "full",
      hint: "Fit the whole record inside the circle. Take the first angle of Side A.",
    },
    {
      label: `${prefix}Side A2 — Full disc`,
      short: `${prefix}Side A2`,
      side: sideKey(disc, "A", 2),
      mode: "full",
      hint: "Take Side A again from a different angle so hidden scratches are visible.",
    },
    {
      label: `${prefix}Side B1 — Full disc`,
      short: `${prefix}Side B1`,
      side: sideKey(disc, "B", 1),
      mode: "full",
      hint: "Flip the record. Fit the whole disc inside the circle. First angle of Side B.",
    },
    {
      label: `${prefix}Side B2 — Full disc`,
      short: `${prefix}Side B2`,
      side: sideKey(disc, "B", 2),
      mode: "full",
      hint: "Take Side B again from a different angle so hidden scratches are visible.",
    },
  ];
};





interface SlotPhoto {
  file: File;
  previewUrl: string;
  /** False when the phone's levelness couldn't be verified at capture time. */
  levelVerified: boolean;
}

const GradeVinylDialog = ({
  open,
  onOpenChange,
  recordId,
  recordTitle,
  recordArtist,
  disc = 1,
  discTotal = 1,
}: GradeVinylDialogProps) => {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const queryClient = useQueryClient();
  const SLOTS = slotsForDisc(disc, discTotal);

  const [stage, setStage] = useState<Stage>("capture");
  const [slots, setSlots] = useState<(SlotPhoto | null)[]>(Array(REQUIRED_PHOTOS).fill(null));
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<SideResult[]>([]);
  const [overall, setOverall] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Record-level warnings returned by the scanner (a 200 can still warn). */
  const [recordWarnings, setRecordWarnings] = useState<string[]>([]);

  const [overlayUrl, setOverlayUrl] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [activeSlot, setActiveSlot] = useState<number>(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [instructionsAck, setInstructionsAck] = useState(false);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filledCount = slots.filter(Boolean).length;

  // The scanner host sleeps when idle: wake it as soon as the dialog opens so
  // the real request doesn't pay the 50s cold start.
  useEffect(() => {
    if (open) wakeScanner();
  }, [open]);

  const reset = () => {
    slots.forEach((s) => s && URL.revokeObjectURL(s.previewUrl));
    setStage("capture");
    setSlots(Array(REQUIRED_PHOTOS).fill(null));
    setResults([]);
    setOverall(null);
    setError(null);
    setRecordWarnings([]);
    setAnalyzing(false);
    setInstructionsAck(false);
  };


  const handleOpenChange = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  /**
   * Regular users must capture grading photos live in-app, so tapping a slot
   * opens the camera directly. Admins get the source picker (camera / library /
   * file) for testing and for reviewing sample images.
   */
  const openPickerFor = (idx: number) => {
    setActiveSlot(idx);
    if (isAdmin) setPickerOpen(true);
    else setCameraOpen(true);
  };

  const chooseCamera = () => {
    setPickerOpen(false);
    setCameraOpen(true);
  };

  const chooseLibrary = () => {
    setPickerOpen(false);
    libraryInputRef.current?.click();
  };

  const chooseFile = () => {
    setPickerOpen(false);
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    // Admin-only path: no live capture, so levelness was never verified.
    handleCapture(file, { levelVerified: false });
  };

  const handleCapture = (file: File, meta: CaptureMeta = { levelVerified: false }) => {
    // The scanner rejects anything over 12 MB per photo (HTTP 413).
    if (file.size > SCANNER_MAX_PHOTO_BYTES) {
      toast.error("This photo is too large (max 12 MB). Please retake it.");
      return;
    }
    const idx = activeSlot;

    setSlots((prev) => {
      const next = [...prev];
      if (next[idx]) URL.revokeObjectURL(next[idx]!.previewUrl);
      next[idx] = {
        file,
        previewUrl: URL.createObjectURL(file),
        levelVerified: meta.levelVerified,
      };
      return next;
    });
  };

  const handleRemoveSlot = (idx: number) => {
    setSlots((prev) => {
      const next = [...prev];
      if (next[idx]) URL.revokeObjectURL(next[idx]!.previewUrl);
      next[idx] = null;
      return next;
    });
  };

  /**
   * Persist photos + per-side analyses. Runs after the results are on screen so
   * the user never waits on storage writes.
   */
  const persist = async (sideResults: SideResult[], overallGrade: string | null) => {
    if (!user) return;
    const sessionId = crypto.randomUUID();
    

    /** Turns a base64 data URI (or bare base64) into a Blob for storage upload. */
    const toBlob = (data: string): Blob => {
      const base64 = data.includes(",") ? data.split(",")[1] : data;
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Blob([bytes], { type: "image/png" });
    };

    const upload = async (path: string, body: Blob | File, contentType: string) => {
      const { error } = await supabase.storage
        .from("record-photos")
        .upload(path, body, { contentType, upsert: false });
      if (error) return null;
      return supabase.storage.from("record-photos").getPublicUrl(path).data.publicUrl;
    };

    try {
      /** Raw + annotated overlay URLs per slot index. */
      const rawUrls: (string | null)[] = [];
      const overlayUrls: (string | null)[] = [];

      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        if (!slot) {
          rawUrls.push(null);
          overlayUrls.push(null);
          continue;
        }
        const ext = (slot.file.name.split(".").pop() || "jpg").toLowerCase();
        // Raw capture: stored for the record, not shown in the grading gallery.
        rawUrls.push(
          await upload(
            `${user.id}/grading/${sessionId}/${i + 1}-${Date.now()}.${ext}`,
            slot.file,
            slot.file.type || "image/jpeg"
          )
        );

        // Annotated overlay returned by the analysis server — this is what the gallery shows.
        const overlay = sideResults[i]?.analysis?.overlay_png;
        overlayUrls.push(
          overlay
            ? await upload(
                `${user.id}/grading/${sessionId}/overlay-${SLOTS[i].side}-${Date.now()}.png`,
                toBlob(overlay),
                "image/png"
              )
            : null
        );
      }

      const publicUrls = rawUrls.filter((u): u is string => !!u);

      const { data: history } = await supabase
        .from("grading_history")
        .insert({
          user_id: user.id,
          record_id: recordId || null,
          record_title: recordTitle || null,
          record_artist: recordArtist || null,
          grade: overallGrade,
          grade_label: overallGrade ? formatGrade(overallGrade) : null,
          summary: "Surface mark analysis (visible marks only).",
          photo_urls: publicUrls,
        } as any)
        .select("id")
        .maybeSingle();

      // Per-side results feed the grading gallery (overlay + grade + coverage).
      const scanRows = sideResults
        .map((r, i) => {
          if (!r.ok || !r.analysis) return null;
          const a = r.analysis;
          return {
            user_id: user.id,
            record_id: recordId || null,
            history_id: (history as any)?.id ?? null,
            side: SLOTS[i].side,
            analysis_id: a.analysis_id ?? null,
            grade: a.grade ?? null,
            mark_count:
              typeof a.mark_count === "number"
                ? a.mark_count
                : Array.isArray(a.marks)
                  ? a.marks.length
                  : null,
            judged_pct: a.coverage?.judged_pct ?? null,
            marks: (a.marks ?? []) as unknown,
            overlay_url: overlayUrls[i],
            raw_photo_url: rawUrls[i],
            // Flags photos captured without a verified-level device.
            level_verified: slots[i]?.levelVerified ?? false,
          };
        })
        .filter(Boolean);

      if (scanRows.length) {
        await supabase.from("record_surface_scans").insert(scanRows as any);
      }

      // Store the resulting grade on the record itself so the grade badge shows
      // on cards / list rows / details. Sealed records are never graded.
      // For a multi-disc set the record's grade is the worst grade across all
      // discs graded so far, not just the disc that was scanned now.
      if (recordId && overallGrade) {
        let recordGrade = overallGrade;
        if (discTotal > 1) {
          const { data: allScans } = await supabase
            .from("record_surface_scans")
            .select("grade")
            .eq("record_id", recordId);
          recordGrade =
            worstGrade([...((allScans as any[]) || []).map((s) => s.grade), overallGrade]) ||
            overallGrade;
        }
        const { error: condErr } = await supabase
          .from("user_records")
          .update({ condition: recordGrade })
          .eq("id", recordId);
        if (condErr) console.warn("Saving record condition failed", condErr);
        queryClient.invalidateQueries({ queryKey: ["user_records"] });
        queryClient.invalidateQueries({ queryKey: ["discover_records"] });
      }

      if (recordId && publicUrls.length) {
        // Only replace previous grading scans — user-uploaded sleeve photos stay.
        // On multi-disc sets each disc keeps its own photos, so nothing is removed.
        if (discTotal <= 1) {
          await supabase
            .from("record_photos")
            .delete()
            .eq("record_id", recordId)
            .eq("photo_type", "grading");
        }

        await supabase
          .from("record_photos")
          .insert(
            rawUrls
              .map((url, i) =>
                url
                  ? {
                      record_id: recordId,
                      photo_url: url,
                      photo_type: "grading",
                      level_verified: slots[i]?.levelVerified ?? false,
                    }
                  : null
              )
              .filter(Boolean) as any
          );
      }
    } catch (e) {
      console.warn("Persisting scan results failed", e);
    }
  };

  /**
   * Sends all four photos to the scanner in a single `/analyze-record` request.
   * The record grade comes back from the server (already the worse of the two
   * sides); the per-photo results feed the result cards and the gallery.
   */
  const handleSubmit = async () => {
    if (filledCount < REQUIRED_PHOTOS) {
      toast.error(`Please add all ${REQUIRED_PHOTOS} photos`);
      return;
    }

    setError(null);
    setRecordWarnings([]);
    setAnalyzing(true);

    const files = slots.map((s) => s!.file) as [File, File, File, File];
    const result = await analyzeRecord(files);
    setAnalyzing(false);

    if (!result.ok) {
      setError(result.error || "Analysis failed. Please try again.");
      return;
    }

    const sideResults = result.photos;
    const overallGrade =
      gradeCode(result.grade) ||
      worstGrade(sideResults.map((r) => (r.ok ? r.analysis?.grade : undefined)));

    setResults(sideResults);
    setOverall(overallGrade);
    setRecordWarnings(result.warnings ?? []);
    setStage("results");

    void persist(sideResults, overallGrade);
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
                {!instructionsAck ? (
                  <div className="flex flex-col gap-4 rounded-xl border border-border bg-background p-5 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                      <Camera size={24} />
                    </div>
                    <div>
                      <p className="font-display text-base font-semibold text-foreground">Before you shoot</p>
                      <p className="font-body text-xs text-muted-foreground mt-1">
                        Follow these steps so the AI can grade accurately.
                      </p>
                    </div>
                    <ol className="flex flex-col gap-2 text-left font-body text-xs text-foreground">
                      <li className="flex gap-2">
                        <span className="font-semibold text-primary">1.</span>
                        <span>Clean the surface of the vinyl before taking the picture.</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-semibold text-primary">2.</span>
                        <span>Avoid submitting a photo with a lot of reflections to avoid false deductions to the grade.</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-semibold text-primary">3.</span>
                        <span>Keep the camera steady above the vinyl according to the allowed angle degrees.</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-semibold text-primary">4.</span>
                        <span>The vinyl grading feature is only available to black vinyl records!</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-semibold text-primary">5.</span>
                        <span>Make sure you are taking a picture of the same side twice, from different angles.</span>
                      </li>
                    </ol>
                    <Button onClick={() => setInstructionsAck(true)} className="w-full gap-2">
                      <Camera size={16} />
                      Start Taking Pictures
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl bg-primary/10 p-3">
                      <p className="font-body text-xs text-foreground">
                        Take <strong>4 photos</strong>: two different angles of <strong>Side A</strong>{" "}
                        (A1, A2) and two different angles of <strong>Side B</strong> (B1, B2). A
                        circular guide will help you frame the disc. Close-up label shots are
                        generated automatically after grading.
                      </p>
                    </div>

                    {error && (
                      <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
                        <p className="font-body text-xs text-destructive">{error}</p>
                      </div>
                    )}

                    <div>
                      <p className="font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        Full disc — both sides, two angles each
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {[0, 1, 2, 3].map((i) => (
                          <SlotButton
                            key={i}
                            spec={SLOTS[i]}
                            slot={slots[i]}
                            onClick={() => openPickerFor(i)}
                            onRemove={() => handleRemoveSlot(i)}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <p className="font-body text-xs text-muted-foreground">
                        {filledCount}/{REQUIRED_PHOTOS} photos
                      </p>
                      {filledCount > 0 && !analyzing && (
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
                      disabled={filledCount < REQUIRED_PHOTOS || analyzing}
                      className="gap-2"
                    >
                      {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Star size={16} />}
                      {analyzing ? "Analyzing all angles..." : "Grade Record"}
                    </Button>

                    {analyzing && (
                      <p className="font-body text-xs text-muted-foreground text-center px-2">
                        {SCANNER_COLD_START_NOTICE}
                      </p>
                    )}
                  </>
                )}
              </motion.div>
            )}

            {stage === "results" && (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-4 pb-2"
              >
                <div className="rounded-xl bg-primary/10 p-5 text-center">
                  <p className="font-body text-[10px] uppercase tracking-wide text-muted-foreground">
                    Suggested grade
                  </p>
                  <p className="font-display text-5xl font-black leading-none text-primary mt-1">
                    {overall ?? "—"}
                  </p>
                  {overall && (
                    <p className="font-display text-sm font-semibold text-foreground mt-2">
                      {formatGrade(overall)}
                    </p>
                  )}
                  <p className="font-body text-[11px] text-muted-foreground mt-3">
                    Based on visible surface marks only. Does not cover warps, edge damage, or how
                    the record sounds. Please confirm before listing.
                  </p>
                </div>

                {results.map((r, i) => (
                  <ScanSideResultCard
                    key={i}
                    side={SLOTS[i].short}
                    result={r}
                    onViewOverlay={setOverlayUrl}
                  />
                ))}

                <Button variant="outline" onClick={reset} className="mt-1">
                  Grade Another Record
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>

      <PhotoLightbox
        urls={overlayUrl ? [overlayUrl] : []}
        index={overlayUrl ? 0 : null}
        onClose={() => setOverlayUrl(null)}
      />

      <CameraCapture
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        mode={activeSpec.mode}
        title={activeSpec.label}
        hint={activeSpec.hint}
        onCapture={handleCapture}
      />

      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelected}
      />

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-display text-base">
              Add {activeSpec.short} photo
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              onClick={chooseCamera}
              className="flex items-center gap-3 rounded-xl bg-primary/10 p-3 text-left transition-colors active:bg-primary/20"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Camera size={18} />
              </div>
              <div>
                <p className="font-body text-sm font-semibold text-foreground">Open camera</p>
                <p className="font-body text-xs text-muted-foreground">Take a photo with the guide</p>
              </div>
            </button>
            {isAdmin && (
            <button
              type="button"
              onClick={chooseLibrary}
              className="flex items-center gap-3 rounded-xl bg-background p-3 text-left transition-colors active:bg-accent"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                <ImageIcon size={18} />
              </div>
              <div>
                <p className="font-body text-sm font-semibold text-foreground">Photo library</p>
                <p className="font-body text-xs text-muted-foreground">Pick an existing image</p>
              </div>
            </button>
            )}
            {isAdmin && (
            <button
              type="button"
              onClick={chooseFile}
              className="flex items-center gap-3 rounded-xl bg-background p-3 text-left transition-colors active:bg-accent"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                <FileUp size={18} />
              </div>
              <div>
                <p className="font-body text-sm font-semibold text-foreground">Upload file</p>
                <p className="font-body text-xs text-muted-foreground">Browse files on device</p>
              </div>
            </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};

interface SlotButtonProps {
  spec: SlotSpec;
  slot: SlotPhoto | null;
  onClick: () => void;
  onRemove: () => void;
}

const SlotButton = ({ spec, slot, onClick, onRemove }: SlotButtonProps) => {
  return (
    <div className="relative aspect-square">
      {slot ? (
        <>
          <button
            type="button"
            onClick={onClick}
            className="block h-full w-full overflow-hidden rounded-lg"
            aria-label={spec.label}
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
          <div className="absolute bottom-0.5 right-0.5 rounded-full bg-emerald-500 p-0.5">
            <CheckCircle2 size={10} className="text-white" />
          </div>
          <div className="absolute inset-x-0 bottom-0 rounded-b-lg bg-black/60 py-0.5 text-center">
            <span className="font-body text-[9px] font-semibold text-white">{spec.short}</span>
          </div>
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
