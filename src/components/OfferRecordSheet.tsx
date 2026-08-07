/**
 * @file OfferRecordSheet.tsx — Read-only record details opened from a trade offer
 * card in the Chats tab.
 *
 * Shows the cover, title/artist, tags, condition grade and (when the record was
 * graded) a "View grading photos" entry with the before/after images per side,
 * so each party can inspect what is actually being traded.
 */
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Disc3, Calendar, Images, Sparkles, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import GradeBadge from "@/components/GradeBadge";
import GradingPhotosViewer from "@/components/GradingPhotosViewer";
import { useRecordSideScans } from "@/lib/gradingScans";
import { displayName, textDirClass } from "@/lib/utils";

interface OfferRecordSheetProps {
  recordId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const OfferRecordSheet = ({ recordId, open, onOpenChange }: OfferRecordSheetProps) => {
  const [gradingOpen, setGradingOpen] = useState(false);

  const { data: record } = useQuery({
    queryKey: ["offer_record", recordId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_records")
        .select("id, title, artist, year, cover_image, condition, format, genre, notes, price, sealed")
        .eq("id", recordId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!recordId && open,
  });

  const sideScans = useRecordSideScans(recordId || undefined, open);
  const hasGradingPhotos = sideScans.some((s) => s.overlayUrl || s.rawUrl);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl border-t border-border bg-card px-0 pb-8">
          <SheetHeader className="px-5 pb-2">
            <SheetTitle className="font-display text-lg text-foreground">Record Details</SheetTitle>
          </SheetHeader>

          {!record ? (
            <p className="px-5 font-body text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="px-5 space-y-5">
              <div className="flex gap-4">
                <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-primary/10">
                  {record.cover_image ? (
                    <img src={record.cover_image} alt={record.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Disc3 size={48} className="text-primary" fill="hsl(var(--primary) / 0.2)" />
                    </div>
                  )}
                  <GradeBadge condition={record.condition} />
                </div>
                <div className="flex flex-1 flex-col justify-center min-w-0">
                  <h2
                    className={`font-display text-base font-bold text-foreground leading-tight ${textDirClass(displayName(record.title))}`}
                  >
                    {displayName(record.title)}
                  </h2>
                  <p
                    className={`mt-1 font-body text-sm text-muted-foreground ${textDirClass(displayName(record.artist))}`}
                  >
                    {displayName(record.artist)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {record.year && (
                      <span className="flex items-center gap-1 font-body text-xs text-muted-foreground">
                        <Calendar size={12} /> {record.year}
                      </span>
                    )}
                    {record.format && (
                      <span className="rounded bg-secondary px-1.5 py-0.5 font-body text-[10px] font-semibold text-secondary-foreground">
                        {record.format}
                      </span>
                    )}
                    {(record as any).sealed && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-1.5 py-0.5 font-body text-[10px] font-bold text-primary">
                        <ShieldCheck size={11} /> Sealed
                      </span>
                    )}
                    {record.condition && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 font-body text-[10px] font-semibold text-secondary-foreground">
                        <Sparkles size={11} /> {record.condition}
                      </span>
                    )}
                    {record.genre && (
                      <span className="rounded-md bg-accent/15 px-1.5 py-0.5 font-body text-[10px] font-semibold text-accent">
                        {record.genre}
                      </span>
                    )}
                  </div>
                  {record.price != null && (
                    <p className="mt-2 font-display text-xl font-bold text-primary">₪{record.price}</p>
                  )}
                </div>
              </div>

              {record.notes && (
                <div>
                  <p className="mb-1 font-body text-xs font-medium text-muted-foreground">Notes</p>
                  <p className="font-body text-sm text-foreground">{record.notes}</p>
                </div>
              )}

              {hasGradingPhotos && (
                <button
                  onClick={() => setGradingOpen(true)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-background p-4 transition-colors active:bg-accent"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Images size={20} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-body text-sm font-semibold text-foreground">View grading photos</p>
                    <p className="font-body text-xs text-muted-foreground">
                      Original photos and the analysed images showing detected scratches
                    </p>
                  </div>
                </button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <GradingPhotosViewer
        open={gradingOpen}
        onOpenChange={setGradingOpen}
        sides={sideScans}
        title="Grading photos"
      />
    </>
  );
};

export default OfferRecordSheet;
