/**
 * @file GradeVinylDialog.tsx — AI-powered vinyl condition grading dialog.
 *
 * **Flow:**
 * 1. **Capture** – User takes a photo of the vinyl surface (via camera or file picker).
 * 2. **Uploading** – Photo is uploaded to the `record-photos` storage bucket.
 * 3. **Grading** – The `grade-vinyl` edge function sends the image to an AI model
 *    that analyzes scratches, scuffs, warping, chips, and surface noise.
 * 4. **Results** – Displays the grade (e.g. NM, G, F), confidence %, detailed
 *    breakdown, and notes. The temporary upload is cleaned up after grading.
 *
 * Grade scale: GEM → M → NM → G → OK → F (best to worst).
 * Each grade has a distinct color for visual clarity.
 */
import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface GradeVinylDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface GradingResult {
  grade: string | null;
  grade_label: string;
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

const gradeColors: Record<string, string> = {
  GEM: "text-emerald-500",
  M: "text-emerald-400",
  NM: "text-green-500",
  G: "text-amber-500",
  OK: "text-orange-500",
  F: "text-destructive",
};

const gradeBackgrounds: Record<string, string> = {
  GEM: "bg-emerald-500/15",
  M: "bg-emerald-400/15",
  NM: "bg-green-500/15",
  G: "bg-amber-500/15",
  OK: "bg-orange-500/15",
  F: "bg-destructive/15",
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

const GradeVinylDialog = ({ open, onOpenChange }: GradeVinylDialogProps) => {
  const { user, session } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("capture");
  const [preview, setPreview] = useState<string | null>(null);
  const [grading, setGrading] = useState<GradingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStage("capture");
    setPreview(null);
    setGrading(null);
    setError(null);
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !session) return;

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setError(null);

    // Upload
    setStage("uploading");
    const fileName = `${user.id}/${Date.now()}-grade-${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("record-photos")
      .upload(fileName, file, { contentType: file.type, upsert: true });

    if (uploadError) {
      setError("Failed to upload photo. Please try again.");
      setStage("capture");
      return;
    }

    // Grade via AI
    setStage("grading");
    try {
      const resp = await supabase.functions.invoke("grade-vinyl", {
        body: { file_path: uploadData.path },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (resp.error) {
        setError("Failed to grade record. Try a clearer photo of the vinyl surface.");
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
    } catch {
      setError("Something went wrong. Please try again.");
      setStage("capture");
    }

    // Clean up
    await supabase.storage.from("record-photos").remove([fileName]);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col">
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
          onChange={handleCapture}
        />

        <div className="flex-1 overflow-hidden flex flex-col">
          <AnimatePresence mode="wait">
            {stage === "capture" && (
              <motion.div
                key="capture"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center py-8 gap-4"
              >
                {preview ? (
                  <img src={preview} alt="Vinyl" className="h-40 w-40 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-40 w-40 items-center justify-center rounded-xl bg-primary/10">
                    <Camera size={48} className="text-primary/40" />
                  </div>
                )}
                {error && (
                  <p className="text-center font-body text-sm text-destructive px-4">{error}</p>
                )}
                <p className="text-center font-body text-sm text-muted-foreground px-4">
                  Take a close-up photo of the vinyl surface to grade its condition
                </p>
                <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
                  <Camera size={18} />
                  {preview ? "Try Again" : "Open Camera"}
                </Button>
              </motion.div>
            )}

            {(stage === "uploading" || stage === "grading") && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center py-8 gap-5"
              >
                {preview && (
                  <img src={preview} alt="Vinyl" className="h-32 w-32 rounded-xl object-cover" />
                )}
                <div className="flex flex-col items-center gap-2">
                  <Loader2 size={28} className="animate-spin text-primary" />
                  <p className="font-body text-sm font-medium text-foreground">
                    {stage === "uploading" ? "Uploading photo..." : "AI is grading your vinyl..."}
                  </p>
                  <p className="font-body text-xs text-muted-foreground">This may take a few seconds</p>
                </div>
              </motion.div>
            )}

            {stage === "results" && grading && (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-4 flex-1 overflow-y-auto"
              >
                {/* Grade Badge */}
                <div className={`rounded-xl p-5 text-center ${gradeBackgrounds[grading.grade || ""] || "bg-muted"}`}>
                  <p className={`font-display text-4xl font-black ${gradeColors[grading.grade || ""] || "text-foreground"}`}>
                    {grading.grade || "?"}
                  </p>
                  <p className="font-display text-sm font-semibold text-foreground mt-1">{grading.grade_label}</p>
                  <p className="font-body text-xs text-muted-foreground mt-1">
                    {grading.confidence}% confidence
                  </p>
                </div>

                {/* Summary */}
                <div className="rounded-xl bg-card p-4">
                  <p className="font-body text-sm text-foreground">{grading.summary}</p>
                </div>

                {/* Details Grid */}
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

                {/* Surface Noise */}
                <div className="rounded-lg bg-card p-3">
                  <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wide">Est. Surface Noise</p>
                  <p className={`font-body text-sm font-semibold capitalize ${severityColor(grading.details.surface_noise_estimate)}`}>
                    {grading.details.surface_noise_estimate}
                  </p>
                </div>

                {/* Notes */}
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
    </Dialog>
  );
};

export default GradeVinylDialog;
