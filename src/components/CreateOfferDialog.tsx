/**
 * @file CreateOfferDialog.tsx — Dialog for creating a trade/purchase offer within a chat.
 *
 * Allows the user to compose an offer by:
 * - Selecting records from their own collection ("You offer").
 * - Selecting records from the other user's visible collection ("They offer").
 * - Adding optional cash amounts on either side (in ₪).
 *
 * On submit, inserts a row into `trade_offers` and related `trade_offer_items`.
 * The offer then appears as an inline card in the chat timeline via `OfferCard`.
 *
 * @see OfferCard – Renders the offer with accept/decline/confirm actions.
 */
import { useState, useEffect } from "react";
import { Plus, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface RecordItem {
  id: string;
  title: string;
  artist: string;
  cover_image: string | null;
}

// Extracted outside to prevent remounting on parent state changes
const RecordGrid = ({
  records,
  selected,
  onToggle,
}: {
  records: RecordItem[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) => (
  records.length === 0 ? (
    <p className="font-body text-xs text-muted-foreground">No records found</p>
  ) : (
    <div className="grid grid-cols-3 gap-2">
      {records.map((r) => {
        const isSelected = selected.has(r.id);
        return (
          <button
            key={r.id}
            onClick={() => onToggle(r.id)}
            className={`relative flex flex-col items-center rounded-lg border-2 p-1.5 transition-all ${
              isSelected
                ? "border-primary bg-primary/10"
                : "border-transparent bg-card hover:border-border"
            }`}
          >
            <div className="mb-1 h-16 w-16 overflow-hidden rounded-md bg-muted">
              {r.cover_image ? (
                <img src={r.cover_image} alt={r.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-display text-lg text-muted-foreground">♪</div>
              )}
            </div>
            <p className="w-full truncate text-center font-body text-[10px] font-semibold text-foreground">{r.title}</p>
            <p className="w-full truncate text-center font-body text-[9px] text-muted-foreground">{r.artist}</p>
            {isSelected && (
              <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                <Plus size={12} className="rotate-45 text-primary-foreground" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  )
);

const CashField = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
  <div className="mt-2">
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-body text-xs font-semibold text-muted-foreground">₪</span>
      <Input
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-7 h-9 font-body text-sm"
      />
    </div>
  </div>
);

interface CreateOfferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: number;
  otherUserId: string;
  otherUserName: string;
  onOfferCreated: () => void;
}

const CreateOfferDialog = ({
  open,
  onOpenChange,
  chatId,
  otherUserId,
  otherUserName,
  onOfferCreated,
}: CreateOfferDialogProps) => {
  const { user } = useAuth();
  const [myRecords, setMyRecords] = useState<RecordItem[]>([]);
  const [theirRecords, setTheirRecords] = useState<RecordItem[]>([]);
  const [selectedMine, setSelectedMine] = useState<Set<string>>(new Set());
  const [selectedTheirs, setSelectedTheirs] = useState<Set<string>>(new Set());
  const [senderCash, setSenderCash] = useState("");
  const [receiverCash, setReceiverCash] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    supabase
      .from("user_records")
      .select("id, title, artist, cover_image")
      .eq("user_id", user.id)
      .then(({ data }) => setMyRecords(data || []));
    supabase
      .from("user_records")
      .select("id, title, artist, cover_image")
      .eq("user_id", otherUserId)
      .then(({ data }) => setTheirRecords(data || []));
  }, [open, user, otherUserId]);

  const toggleRecord = (id: string, set: Set<string>, setFn: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setFn(next);
  };

  const hasContent =
    selectedMine.size > 0 ||
    selectedTheirs.size > 0 ||
    (senderCash && parseFloat(senderCash) > 0) ||
    (receiverCash && parseFloat(receiverCash) > 0);

  const handleSubmit = async () => {
    if (!user || !hasContent) return;
    setSubmitting(true);

    const { data: offer, error } = await supabase
      .from("trade_offers")
      .insert({
        chat_id: chatId,
        sender_id: user.id,
        receiver_id: otherUserId,
        sender_cash: senderCash ? parseFloat(senderCash) : 0,
        receiver_cash: receiverCash ? parseFloat(receiverCash) : 0,
      })
      .select("id")
      .single();

    if (error || !offer) {
      setSubmitting(false);
      return;
    }

    const items = [
      ...[...selectedMine].map((rid) => ({ offer_id: offer.id, record_id: rid, owner_id: user.id })),
      ...[...selectedTheirs].map((rid) => ({ offer_id: offer.id, record_id: rid, owner_id: otherUserId })),
    ];

    if (items.length > 0) {
      await supabase.from("trade_offer_items").insert(items);
    }

    setSubmitting(false);
    setSelectedMine(new Set());
    setSelectedTheirs(new Set());
    setSenderCash("");
    setReceiverCash("");
    onOpenChange(false);
    onOfferCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="font-display text-lg">Create Offer</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 min-h-0">
          <div className="space-y-4 pb-4">
            {/* Your side */}
            <div>
              <p className="mb-2 font-body text-xs font-semibold text-muted-foreground uppercase tracking-wide">You offer</p>
              <RecordGrid
                records={myRecords}
                selected={selectedMine}
                onToggle={(id) => toggleRecord(id, selectedMine, setSelectedMine)}
              />
              <CashField value={senderCash} onChange={setSenderCash} placeholder="My funds" />
            </div>

            <div className="flex items-center justify-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <ArrowRight size={14} className="text-muted-foreground" />
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Their side */}
            <div>
              <p className="mb-2 font-body text-xs font-semibold text-muted-foreground uppercase tracking-wide">{otherUserName} offers</p>
              <RecordGrid
                records={theirRecords}
                selected={selectedTheirs}
                onToggle={(id) => toggleRecord(id, selectedTheirs, setSelectedTheirs)}
              />
              <CashField value={receiverCash} onChange={setReceiverCash} placeholder={`${otherUserName.split(" ")[0]}'s funds`} />
            </div>
          </div>
        </div>

        <div className="border-t border-border px-4 py-3">
          <Button
            onClick={handleSubmit}
            disabled={submitting || !hasContent}
            className="w-full font-body font-semibold"
          >
            {submitting ? "Sending..." : "Send Offer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateOfferDialog;
