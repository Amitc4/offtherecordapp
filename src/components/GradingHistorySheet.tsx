/**
 * @file GradingHistorySheet.tsx — Displays a list of past AI vinyl gradings.
 *
 * Fetches from `grading_history` table, showing grade badge, record info,
 * confidence, and date for each entry. Users can delete old entries.
 */
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Star, Trash2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface GradingHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface GradingEntry {
  id: string;
  record_title: string | null;
  record_artist: string | null;
  grade: string | null;
  grade_label: string | null;
  confidence: number | null;
  summary: string | null;
  created_at: string;
}

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

const GradingHistorySheet = ({ open, onOpenChange }: GradingHistorySheetProps) => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<GradingEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && user) {
      setLoading(true);
      supabase
        .from("grading_history")
        .select("id, record_title, record_artist, grade, grade_label, confidence, summary, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .then(({ data, error }) => {
          if (!error) setEntries(data || []);
          setLoading(false);
        });
    }
  }, [open, user]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("grading_history").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete entry");
    } else {
      setEntries((prev) => prev.filter((e) => e.id !== id));
      toast.success("Entry removed");
    }
  };

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
                  {/* Grade badge */}
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${gradeBackgrounds[entry.grade || ""] || "bg-muted"}`}>
                    <span className={`font-display text-lg font-black ${gradeColors[entry.grade || ""] || "text-foreground"}`}>
                      {entry.grade || "?"}
                    </span>
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
