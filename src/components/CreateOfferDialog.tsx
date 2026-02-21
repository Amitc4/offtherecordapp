import { useState, useEffect } from "react";
import { X, Plus, Minus, DollarSign, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Record {
  id: string;
  title: string;
  artist: string;
  cover_image: string | null;
}

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
  const [myRecords, setMyRecords] = useState<Record[]>([]);
  const [theirRecords, setTheirRecords] = useState<Record[]>([]);
  const [selectedMine, setSelectedMine] = useState<Set<string>>(new Set());
  const [selectedTheirs, setSelectedTheirs] = useState<Set<string>>(new Set());
  const [cashAmount, setCashAmount] = useState("");
  const [cashDirection, setCashDirection] = useState<"none" | "sender_pays" | "receiver_pays">("none");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    // Fetch my records
    supabase
      .from("user_records")
      .select("id, title, artist, cover_image")
      .eq("user_id", user.id)
      .then(({ data }) => setMyRecords(data || []));
    // Fetch their records (allowed by friends RLS)
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

  const handleSubmit = async () => {
    if (!user) return;
    if (selectedMine.size === 0 && selectedTheirs.size === 0 && !cashAmount) return;
    setSubmitting(true);

    const { data: offer, error } = await supabase
      .from("trade_offers")
      .insert({
        chat_id: chatId,
        sender_id: user.id,
        receiver_id: otherUserId,
        cash_amount: cashAmount ? parseFloat(cashAmount) : 0,
        cash_direction: cashAmount ? cashDirection : "none",
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
    setCashAmount("");
    setCashDirection("none");
    onOpenChange(false);
    onOfferCreated();
  };

  const RecordGrid = ({
    records,
    selected,
    onToggle,
    label,
  }: {
    records: Record[];
    selected: Set<string>;
    onToggle: (id: string) => void;
    label: string;
  }) => (
    <div>
      <p className="mb-2 font-body text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      {records.length === 0 ? (
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
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="font-display text-lg">Create Offer</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-4">
          <div className="space-y-4 pb-4">
            <RecordGrid
              records={myRecords}
              selected={selectedMine}
              onToggle={(id) => toggleRecord(id, selectedMine, setSelectedMine)}
              label="Your Records"
            />

            <div className="flex items-center justify-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <ArrowRight size={14} className="text-muted-foreground" />
              <div className="h-px flex-1 bg-border" />
            </div>

            <RecordGrid
              records={theirRecords}
              selected={selectedTheirs}
              onToggle={(id) => toggleRecord(id, selectedTheirs, setSelectedTheirs)}
              label={`${otherUserName}'s Records`}
            />

            <div className="space-y-2">
              <p className="font-body text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cash Amount</p>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="number"
                    min="0"
                    value={cashAmount}
                    onChange={(e) => {
                      setCashAmount(e.target.value);
                      if (e.target.value && cashDirection === "none") setCashDirection("sender_pays");
                    }}
                    placeholder="0"
                    className="pl-8 font-body text-sm"
                  />
                </div>
              </div>
              {cashAmount && parseFloat(cashAmount) > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setCashDirection("sender_pays")}
                    className={`flex-1 rounded-lg px-3 py-2 font-body text-xs font-medium transition-colors ${
                      cashDirection === "sender_pays"
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-foreground"
                    }`}
                  >
                    You pay
                  </button>
                  <button
                    onClick={() => setCashDirection("receiver_pays")}
                    className={`flex-1 rounded-lg px-3 py-2 font-body text-xs font-medium transition-colors ${
                      cashDirection === "receiver_pays"
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-foreground"
                    }`}
                  >
                    {otherUserName} pays
                  </button>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <div className="border-t border-border px-4 py-3">
          <Button
            onClick={handleSubmit}
            disabled={submitting || (selectedMine.size === 0 && selectedTheirs.size === 0 && !cashAmount)}
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
