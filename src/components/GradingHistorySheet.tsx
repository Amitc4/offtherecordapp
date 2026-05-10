/**
 * @file GradingHistorySheet.tsx — Displays a list of past AI vinyl gradings.
 *
 * Fetches from `grading_history` table, showing grade badge, record info,
 * confidence, and date for each entry. Users can delete old entries.
 */
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Star, Trash2, Clock, Images } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import GradingPhotosViewer, { type PhotoDefect } from "@/components/GradingPhotosViewer";

/** Props for the bottom-sheet that lists past gradings. */
interface GradingHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Single row from the `grading_history` table shown in the list. */
/** Single row from the `grading_history` table shown in the list. */
interface GradingEntry {
  id: string;
  record_title: string | null;
  record_artist: string | null;
  score: number | null;
  grade_label: string | null;
  confidence: number | null;
  summary: string | null;
  created_at: string;
  photo_urls: string[] | null;
  defects: PhotoDefect[][] | null;
}

/** Tailwind text color for the decimal score (best → worst). */
const scoreColor = (s: number | null): string => {
  if (s === null) return "text-foreground";
  if (s >= 9.5) return "text-emerald-500";
  if (s >= 9.0) return "text-emerald-400";
  if (s >= 8.0) return "text-green-500";
  if (s >= 7.0) return "text-amber-500";
  if (s >= 5.5) return "text-orange-500";
  return "text-destructive";
};

/** Tinted badge background per score range. */
const scoreBackground = (s: number | null): string => {
  if (s === null) return "bg-muted";
  if (s >= 9.5) return "bg-emerald-500/15";
  if (s >= 9.0) return "bg-emerald-400/15";
  if (s >= 8.0) return "bg-green-500/15";
  if (s >= 7.0) return "bg-amber-500/15";
  if (s >= 5.5) return "bg-orange-500/15";
  return "bg-destructive/15";
};

const GradingHistorySheet = ({ open, onOpenChange }: GradingHistorySheetProps) => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<GradingEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && user) {
      setLoading(true);
      supabase
        .from("grading_history")
        .select("id, record_title, record_artist, score, grade_label, confidence, summary, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .then(({ data, error }) => {
          if (!error) setEntries((data as any) || []);
          setLoading(false);
        });
    }
  }, [open, user]);

  /** Delete a grading entry by id. RLS ensures only the owner can delete. */
  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("grading_history").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete entry");
    } else {
      setEntries((prev) => prev.filter((e) => e.id !== id));
      toast.success("Entry removed");
    }
  };

  /** Locale-aware short date for the entry footer (e.g. "May 5, 2026"). */
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="font-display flex items-center gap-2">
            <Star size={20} className="text-primary" />
            Grading History
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-3 overflow-y-auto max-h-[70vh] pr-1">
          {loading ? (
            <p className="text-center font-body text-sm text-muted-foreground py-8">Loading...</p>
          ) : entries.length === 0 ? (
            <div className="text-center py-12">
              <Star size={40} className="mx-auto mb-3 text-muted-foreground/30" />
              <p className="font-body text-sm text-muted-foreground">No gradings yet</p>
              <p className="font-body text-xs text-muted-foreground mt-1">
                Use the Grade Vinyl tool from your collection to get AI-powered condition grading
              </p>
            </div>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="rounded-xl bg-card p-4 vinyl-shadow">
                <div className="flex items-start gap-3">
                  {/* Score badge */}
                  <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl ${scoreBackground(entry.score)}`}>
                    <span className={`font-display text-base font-black leading-none ${scoreColor(entry.score)}`}>
                      {entry.score !== null ? entry.score.toFixed(1) : "?"}
                    </span>
                    <span className="font-body text-[8px] text-muted-foreground mt-0.5">/ 10</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-display text-sm font-semibold text-foreground truncate">
                      {entry.record_title || "Unknown Record"}
                    </p>
                    <p className="font-body text-xs text-muted-foreground truncate">
                      {entry.record_artist || "Unknown Artist"}
                    </p>
                    <div className="mt-1 flex items-center gap-3">
                      <span className="font-body text-[10px] text-muted-foreground">
                        {entry.grade_label}
                      </span>
                      {entry.confidence && (
                        <span className="font-body text-[10px] text-muted-foreground">
                          {entry.confidence}% confidence
                        </span>
                      )}
                    </div>
                    {entry.summary && (
                      <p className="mt-2 font-body text-xs text-muted-foreground line-clamp-2">
                        {entry.summary}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="shrink-0 p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="mt-2 flex items-center gap-1 text-muted-foreground">
                  <Clock size={10} />
                  <span className="font-body text-[10px]">{formatDate(entry.created_at)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default GradingHistorySheet;
