/**
 * @file UserCollectionSheet.tsx — Bottom sheet displaying another user's record collection.
 *
 * Shown when viewing a friend's or chat partner's collection. Has two tabs:
 * - **Personal** – Records with status "personal" (visible to friends only via RLS).
 * - **For Sale** – Records listed for sale/trade (visible to all authenticated users).
 *
 * Each record card shows cover art, title, artist, price (if for sale), and condition.
 */
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Disc3, ShieldCheck, Sparkles } from "lucide-react";
import GradeBadge from "@/components/GradeBadge";
import { displayName } from "@/lib/utils";

interface UserCollectionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

interface RecordRow {
  id: string;
  title: string;
  artist: string;
  cover_image: string | null;
  year: number | null;
  format: string | null;
  condition: string | null;
  status: string;
  price: number | null;
  genre: string | null;
}

const UserCollectionSheet = ({ open, onOpenChange, userId, userName }: UserCollectionSheetProps) => {
  const [tab, setTab] = useState<"personal" | "for_sale">("personal");

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["user-collection-view", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_records")
        .select("*")
        .eq("user_id", userId);
      if (error) throw error;
      return data as RecordRow[];
    },
    enabled: open && !!userId,
  });

  const personal = records.filter((r) => r.status === "personal");
  const forSale = records.filter((r) => r.status === "for_sale");
  const displayed = tab === "personal" ? personal : forSale;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl p-0">
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="font-display text-lg">{userName}'s Collection</SheetTitle>
        </SheetHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "personal" | "for_sale")} className="px-4">
          <TabsList className="w-full">
            <TabsTrigger value="personal" className="flex-1 font-body text-xs">
              Personal ({personal.length})
            </TabsTrigger>
            <TabsTrigger value="for_sale" className="flex-1 font-body text-xs">
              For Sale ({forSale.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6" style={{ maxHeight: "calc(85vh - 120px)" }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Disc3 size={32} className="animate-spin text-muted-foreground/40" />
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <Disc3 size={40} className="mb-3 text-muted-foreground/30" />
              <p className="font-body text-sm text-muted-foreground">
                No {tab === "personal" ? "personal" : "for sale"} records
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {displayed.map((record) => (
                <div key={record.id} className="rounded-xl bg-card p-2.5 vinyl-shadow">
                  <div className="mb-2 flex aspect-square items-center justify-center rounded-lg bg-primary/10 overflow-hidden">
                    {record.cover_image ? (
                      <img src={record.cover_image} alt={record.title} className="h-full w-full object-cover" />
                    ) : (
                      <Disc3 size={36} className="text-primary" />
                    )}
                    <GradeBadge condition={record.condition} />
                  </div>
                  <h3 className="font-display text-sm font-semibold leading-tight text-foreground truncate">{displayName(record.title)}</h3>
                  <p className="mt-0.5 font-display text-xs text-muted-foreground truncate">{displayName(record.artist)}</p>
                  <div className="mt-1.5 flex items-center justify-between gap-1">
                    {record.status === "for_sale" && record.price != null ? (
                      <span className="font-body text-sm font-bold text-primary">₪{record.price}</span>
                    ) : (
                      <span className="font-body text-xs text-muted-foreground">{record.year || "—"}</span>
                    )}
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      {(record as any).sealed && (
                        <span className="inline-flex items-center gap-1 rounded bg-primary/15 px-1.5 py-0.5 font-body text-[9px] font-bold text-primary">
                          <ShieldCheck size={10} /> Sealed
                        </span>
                      )}
                      {record.condition && (
                        <span className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 font-body text-[9px] font-semibold text-secondary-foreground">
                          <Sparkles size={10} /> {record.condition}
                        </span>
                      )}
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default UserCollectionSheet;
