import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Disc3, Plus, Loader2, ScanLine, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface ScanRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DiscogsResult {
  id: number;
  title: string;
  year: number | null;
  cover_image: string | null;
  format: string | null;
}

type Stage = "capture" | "uploading" | "identifying" | "results";

const ScanRecordDialog = ({ open, onOpenChange }: ScanRecordDialogProps) => {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("capture");
  const [preview, setPreview] = useState<string | null>(null);
  const [identification, setIdentification] = useState<{ title: string; artist: string } | null>(null);
  const [results, setResults] = useState<DiscogsResult[]>([]);
  const [adding, setAdding] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStage("capture");
    setPreview(null);
    setIdentification(null);
    setResults([]);
    setError(null);
    setAdding(null);
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const triggerCamera = () => fileInputRef.current?.click();
  const triggerGallery = () => galleryInputRef.current?.click();

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !session) return;

    // Reset input so the same file can be re-selected
    e.target.value = "";

    // Show preview
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setError(null);

    // Upload to storage
    setStage("uploading");
    const fileName = `${user.id}/${Date.now()}-${file.name}`;
    let uploadPath: string;
    try {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("record-photos")
        .upload(fileName, file, { contentType: file.type, upsert: true });

      if (uploadError || !uploadData?.path) {
        console.error("Upload error:", uploadError);
        setError("Failed to upload photo. Please try again.");
        setStage("capture");
        return;
      }
      uploadPath = uploadData.path;
    } catch (err) {
      console.error("Upload exception:", err);
      setError("Failed to upload photo. Please try again.");
      setStage("capture");
      return;
    }

    // Identify via AI — prioritizes cover art visual matching, then text on the cover
    setStage("identifying");
    try {
      const resp = await supabase.functions.invoke("identify-record", {
        body: { file_path: uploadPath },
      });

      const data = resp.data;
      if (!data || resp.error) {
        console.error("Identify error:", resp.error);
        setError("Failed to identify record. Try a clearer photo.");
        setStage("capture");
        return;
      }

      if (data.error && (!data.results || data.results.length === 0)) {
        setError(data.error);
        setStage("capture");
        return;
      }

      setIdentification(data.identification || null);
      setResults(data.results || []);
      setStage("results");
    } catch (err) {
      console.error("Identify exception:", err);
      setError("Something went wrong. Please try again.");
      setStage("capture");
    }

    // Clean up uploaded photo
    await supabase.storage.from("record-photos").remove([uploadPath]);
  };

  const addToCollection = async (item: DiscogsResult) => {
    if (!user) return;
    setAdding(item.id);
    const parts = item.title.split(" - ");
    const artistName = parts.length > 1 ? parts[0].trim() : identification?.artist || "Unknown";
    const titleName = parts.length > 1 ? parts.slice(1).join(" - ").trim() : item.title;

    const { error } = await supabase.from("user_records").insert({
      user_id: user.id,
      title: titleName,
      artist: artistName,
      year: item.year,
      cover_image: item.cover_image,
      discogs_release_id: item.id,
      format: item.format,
    });

    if (error) {
      toast.error("Failed to add record");
    } else {
      toast.success("Added to collection!");
      queryClient.invalidateQueries({ queryKey: ["user_records"] });
    }
    setAdding(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <ScanLine size={20} className="text-primary" />
            Scan Record
          </DialogTitle>
        </DialogHeader>

        {/* Hidden camera input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleCapture}
        />
        {/* Hidden gallery input (no capture attribute) */}
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleCapture}
        />

        <div className="flex-1 overflow-hidden flex flex-col">
          <AnimatePresence mode="wait">
            {/* Capture stage */}
            {stage === "capture" && (
              <motion.div
                key="capture"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center py-8 gap-4"
              >
                {preview ? (
                  <img src={preview} alt="Captured" className="h-40 w-40 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-40 w-40 items-center justify-center rounded-xl bg-primary/10">
                    <Camera size={48} className="text-primary/40" />
                  </div>
                )}
                {error && (
                  <p className="text-center font-body text-sm text-destructive px-4">{error}</p>
                )}
                <p className="text-center font-body text-sm text-muted-foreground px-4">
                  Take a photo of the record's cover art to identify it
                </p>
                <div className="flex gap-2">
                  <Button onClick={triggerCamera} className="gap-2">
                    <Camera size={18} />
                    {preview ? "Retake" : "Camera"}
                  </Button>
                  <Button onClick={triggerGallery} variant="outline" className="gap-2">
                    <ImageIcon size={18} />
                    Photo Library
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Uploading / Identifying stages */}
            {(stage === "uploading" || stage === "identifying") && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center py-8 gap-5"
              >
                {preview && (
                  <img src={preview} alt="Captured" className="h-32 w-32 rounded-xl object-cover" />
                )}
                <div className="flex flex-col items-center gap-2">
                  <Loader2 size={28} className="animate-spin text-primary" />
                  <p className="font-body text-sm font-medium text-foreground">
                    {stage === "uploading" ? "Uploading photo..." : "AI is identifying your record..."}
                  </p>
                  <p className="font-body text-xs text-muted-foreground">This may take a few seconds</p>
                </div>
              </motion.div>
            )}

            {/* Results stage */}
            {stage === "results" && (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-3 flex-1 overflow-hidden"
              >
                {identification && (
                  <div className="rounded-xl bg-primary/10 p-3">
                    <p className="font-body text-[11px] font-medium text-primary uppercase tracking-wide">AI Identified</p>
                    <p className="font-display text-sm font-bold text-foreground">{identification.title}</p>
                    <p className="font-body text-xs text-muted-foreground">{identification.artist}</p>
                  </div>
                )}

                {results.length > 0 ? (
                  <>
                    <p className="font-body text-xs text-muted-foreground">{results.length} matches found on Discogs</p>
                    <div className="flex-1 overflow-y-auto space-y-2">
                      {results.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 rounded-lg bg-card p-3">
                          {item.cover_image ? (
                            <img src={item.cover_image} alt={item.title} className="h-10 w-10 rounded object-cover" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded bg-primary/10">
                              <Disc3 size={18} className="text-primary" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-body text-xs font-medium text-foreground truncate">{item.title}</p>
                            <p className="font-body text-[10px] text-muted-foreground">
                              {item.year || "—"}{item.format ? ` · ${item.format}` : ""}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => addToCollection(item)}
                            disabled={adding === item.id}
                            className="shrink-0"
                          >
                            {adding === item.id ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="py-4 text-center font-body text-sm text-muted-foreground">
                    No matches found. Try a different photo.
                  </p>
                )}

                <Button variant="outline" onClick={reset} className="mt-2">
                  Scan Another Record
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ScanRecordDialog;
