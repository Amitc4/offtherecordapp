/**
 * @file TransactionHistorySheet.tsx — Bottom sheet listing all completed trades.
 *
 * Fetches completed trade offers (`status = 'completed'`) involving the current user,
 * enriches them with participant names and traded record details, then displays
 * each transaction as a card showing:
 * - "You gave" – Records and/or cash the user contributed.
 * - "You received" – Records and/or cash the user got in return.
 * - Trade partner name and completion date.
 *
 * Accessed from the Profile screen's "Transaction History" menu item.
 */
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ArrowRightLeft, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Transaction {
  id: string;
  sender_id: string;
  receiver_id: string;
  sender_cash: number;
  receiver_cash: number;
  created_at: string;
  senderName: string;
  receiverName: string;
  senderItems: { title: string; artist: string; cover_image: string | null }[];
  receiverItems: { title: string; artist: string; cover_image: string | null }[];
}

interface TransactionHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TransactionHistorySheet = ({ open, onOpenChange }: TransactionHistorySheetProps) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);

    (async () => {
      const { data: offers } = await supabase
        .from("trade_offers")
        .select("id, sender_id, receiver_id, sender_cash, receiver_cash, created_at")
        .eq("status", "completed")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (!offers || offers.length === 0) {
        setTransactions([]);
        setLoading(false);
        return;
      }

      // Get all participant IDs
      const userIds = [...new Set(offers.flatMap(o => [o.sender_id, o.receiver_id]))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, nickname, first_name")
        .in("user_id", userIds);

      const nameMap = new Map(
        (profiles || []).map(p => [p.user_id, p.nickname || p.first_name || p.display_name || "Unknown"])
      );

      // Get all items for these offers
      const offerIds = offers.map(o => o.id);
      const { data: allItems } = await supabase
        .from("trade_offer_items")
        .select("offer_id, owner_id, record_id")
        .in("offer_id", offerIds);

      // Get record details
      const recordIds = [...new Set((allItems || []).map(i => i.record_id))];
      const { data: records } = recordIds.length
        ? await supabase
            .from("user_records")
            .select("id, title, artist, cover_image")
            .in("id", recordIds)
        : { data: [] };

      const recordMap = new Map((records || []).map(r => [r.id, r]));

      const enriched: Transaction[] = offers.map(offer => {
        const items = (allItems || []).filter(i => i.offer_id === offer.id);
        const senderItems = items
          .filter(i => i.owner_id === offer.sender_id)
          .map(i => recordMap.get(i.record_id))
          .filter(Boolean) as { title: string; artist: string; cover_image: string | null }[];
        const receiverItems = items
          .filter(i => i.owner_id === offer.receiver_id)
          .map(i => recordMap.get(i.record_id))
          .filter(Boolean) as { title: string; artist: string; cover_image: string | null }[];

        return {
          ...offer,
          sender_cash: Number(offer.sender_cash) || 0,
          receiver_cash: Number(offer.receiver_cash) || 0,
          senderName: nameMap.get(offer.sender_id) || "Unknown",
          receiverName: nameMap.get(offer.receiver_id) || "Unknown",
          senderItems,
          receiverItems,
        };
      });

      setTransactions(enriched);
      setLoading(false);
    })();
  }, [open, user]);

  const RecordPill = ({ record }: { record: { title: string; artist: string; cover_image: string | null } }) => (
    <div className="flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1">
      <div className="h-7 w-7 shrink-0 overflow-hidden rounded bg-card">
        {record.cover_image ? (
          <img src={record.cover_image} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">♪</div>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate font-body text-[10px] font-semibold text-foreground">{record.title}</p>
        <p className="truncate font-body text-[9px] text-muted-foreground">{record.artist}</p>
      </div>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl bg-background">
        <SheetHeader className="pb-2">
          <SheetTitle className="font-display text-lg text-foreground">Transaction History</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : transactions.length === 0 ? (
          <p className="py-12 text-center font-body text-sm text-muted-foreground">No completed transactions yet.</p>
        ) : (
          <div className="space-y-3 pb-4">
            {transactions.map((tx) => {
              const isSender = user?.id === tx.sender_id;
              const otherName = isSender ? tx.receiverName : tx.senderName;
              const date = new Date(tx.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

              return (
                <div key={tx.id} className="rounded-xl border border-border bg-card p-3 vinyl-shadow">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Check size={12} className="text-primary" />
                      <span className="font-body text-[10px] font-bold uppercase tracking-wider text-primary">Completed</span>
                    </div>
                    <span className="font-body text-[10px] text-muted-foreground">{date}</span>
                  </div>

                  <p className="mb-2 font-body text-xs text-muted-foreground">
                    Trade with <span className="font-semibold text-foreground">{otherName}</span>
                  </p>

                  {/* What you gave */}
                  {(() => {
                    const myItems = isSender ? tx.senderItems : tx.receiverItems;
                    const myCash = isSender ? tx.sender_cash : tx.receiver_cash;
                    return (myItems.length > 0 || myCash > 0) ? (
                      <div className="mb-2">
                        <p className="mb-1 font-body text-[9px] font-semibold text-muted-foreground uppercase">You gave</p>
                        <div className="space-y-1">
                          {myItems.map((r, i) => <RecordPill key={i} record={r} />)}
                          {myCash > 0 && (
                            <div className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1.5">
                              <span className="font-body text-xs font-semibold text-primary">₪{myCash}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null;
                  })()}

                  {/* What you received */}
                  {(() => {
                    const theirItems = isSender ? tx.receiverItems : tx.senderItems;
                    const theirCash = isSender ? tx.receiver_cash : tx.sender_cash;
                    return (theirItems.length > 0 || theirCash > 0) ? (
                      <div>
                        <p className="mb-1 font-body text-[9px] font-semibold text-muted-foreground uppercase">You received</p>
                        <div className="space-y-1">
                          {theirItems.map((r, i) => <RecordPill key={i} record={r} />)}
                          {theirCash > 0 && (
                            <div className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1.5">
                              <span className="font-body text-xs font-semibold text-primary">₪{theirCash}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default TransactionHistorySheet;
