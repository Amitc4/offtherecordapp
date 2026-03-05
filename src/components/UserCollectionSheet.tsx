import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Disc3 } from "lucide-react";

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
            <div className="space-y-2">
              {displayed.map((record) => (
                <div key={record.id} className="flex items-center gap-3 rounded-xl bg-card p-3 vinyl-shadow">
                  {record.cover_image ? (
                    <img
                      src={record.cover_image}
                      alt={record.title}
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                      <Disc3 size={20} className="text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-body text-sm font-semibold text-foreground">{record.title}</p>
                    <p className="truncate font-body text-xs text-muted-foreground">{record.artist}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      {record.year && (
                        <span className="font-body text-[10px] text-muted-foreground">{record.year}</span>
                      )}
                      {record.format && (
                        <span className="font-body text-[10px] text-muted-foreground">· {record.format}</span>
                      )}
                      {record.condition && (
                        <span className="font-body text-[10px] text-muted-foreground">· {record.condition}</span>
                      )}
                    </div>
                  </div>
                  {record.status === "for_sale" && record.price != null && (
                    <span className="font-display text-sm font-bold text-primary">₪{record.price}</span>
                  )}
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
