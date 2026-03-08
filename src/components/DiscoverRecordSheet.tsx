import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Disc3, Calendar, MessageCircle, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import ReportBlockDialog from "@/components/ReportBlockDialog";

interface DiscoverRecord {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  cover_image: string | null;
  condition: string | null;
  format: string | null;
  notes: string | null;
  price?: number | null;
  genre?: string | null;
  user_id: string;
}

interface DiscoverRecordSheetProps {
  record: DiscoverRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContactSeller: (record: DiscoverRecord, sellerName: string) => void;
}

const DiscoverRecordSheet = ({ record, open, onOpenChange, onContactSeller }: DiscoverRecordSheetProps) => {
  const [reportOpen, setReportOpen] = useState(false);

  const { data: sellerProfile } = useQuery({
    queryKey: ["seller_profile", record?.user_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, short_id")
        .eq("user_id", record!.user_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!record?.user_id,
  });

  // Fetch record photos
  const { data: recordPhotos = [] } = useQuery({
    queryKey: ["record_photos", record?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("record_photos")
        .select("id, photo_url")
        .eq("record_id", record!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!record?.id,
  });

  if (!record) return null;

  const sellerName = sellerProfile?.display_name || "User";
  const sellerInitial = sellerName.charAt(0).toUpperCase();
  const price = record.price;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl border-t border-border bg-card px-0 pb-8">
          <SheetHeader className="px-5 pb-2">
            <SheetTitle className="font-display text-lg text-foreground">Record Details</SheetTitle>
          </SheetHeader>

          <div className="px-5 space-y-5">
            {/* Cover + title area */}
            <div className="flex gap-4">
              <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-primary/10">
                {record.cover_image ? (
                  <img src={record.cover_image} alt={record.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Disc3 size={48} className="text-primary" fill="hsl(var(--primary) / 0.2)" />
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col justify-center min-w-0">
                <h2 className="font-display text-base font-bold text-foreground leading-tight">{record.title}</h2>
                <p className="mt-1 font-display text-sm text-muted-foreground">{record.artist}</p>
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
                  {record.condition && (
                    <span className="rounded-md bg-primary/15 px-1.5 py-0.5 font-body text-[10px] font-semibold text-primary">
                      {record.condition}
                    </span>
                  )}
                  {record.genre && (
                    <span className="rounded-md bg-accent/15 px-1.5 py-0.5 font-body text-[10px] font-semibold text-accent">
                      {record.genre}
                    </span>
                  )}
                </div>
                {price != null && (
                  <p className="mt-2 font-display text-xl font-bold text-primary">₪{price}</p>
                )}
              </div>
            </div>

            {/* Condition photos */}
            {recordPhotos.length > 0 && (
              <div>
                <p className="mb-2 font-body text-xs font-medium text-muted-foreground">Condition Photos</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {recordPhotos.map((photo: any) => (
                    <img
                      key={photo.id}
                      src={photo.photo_url}
                      alt="Record condition"
                      className="h-24 w-24 shrink-0 rounded-lg object-cover"
                    />
                  ))}
                </div>
              </div>
            )}

            {record.notes && (
              <div>
                <p className="mb-1 font-body text-xs font-medium text-muted-foreground">Notes</p>
                <p className="font-body text-sm text-foreground">{record.notes}</p>
              </div>
            )}

            {/* Seller info */}
            <div className="flex items-center gap-3 rounded-xl bg-background p-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 font-display text-sm font-bold text-primary">
                {sellerInitial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body text-sm font-semibold text-foreground">{sellerName}</p>
              </div>
              <button
                onClick={() => setReportOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                title="Report or block user"
              >
                <Flag size={14} />
              </button>
            </div>

            {/* Contact seller */}
            <Button
              onClick={() => onContactSeller(record, sellerName)}
              className="w-full gap-2 h-12 font-body text-sm font-semibold"
            >
              <MessageCircle size={18} />
              Contact Seller
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ReportBlockDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetUserId={record.user_id}
        targetUserName={sellerName}
      />
    </>
  );
};

export default DiscoverRecordSheet;
