/**
 * @file OfferCard.tsx — Inline trade offer card displayed within the chat timeline.
 *
 * Shows what each side is offering (records + cash) and provides action buttons
 * based on the offer's current status:
 *
 * | Status    | Receiver sees            | Sender sees              |
 * |-----------|--------------------------|--------------------------|
 * | pending   | Accept / Decline / Counter | Waiting… / Change Offer |
 * | accepted  | Confirm Complete         | Confirm Complete         |
 * | completed | Leave a Review           | Leave a Review           |
 * | declined  | (no actions)             | (no actions)             |
 *
 * When both parties confirm completion, the status transitions to "completed"
 * and a review form becomes available (1–5 stars + optional text).
 *
 * @see CreateOfferDialog – Used to create or counter an offer.
 */
import { useState, useEffect } from "react";
import { Check, X, Star, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface OfferItem {
  id: string;
  record_id: string;
  owner_id: string;
  record?: { title: string; artist: string; cover_image: string | null };
}

interface Offer {
  id: string;
  sender_id: string;
  receiver_id: string;
  sender_cash: number;
  receiver_cash: number;
  status: string;
  sender_confirmed: boolean;
  receiver_confirmed: boolean;
  created_at: string;
}

interface OfferCardProps {
  offer: Offer;
  senderName: string;
  receiverName: string;
  onUpdate: () => void;
  onCounterOffer?: () => void;
}

const OfferCard = ({ offer, senderName, receiverName, onUpdate, onCounterOffer }: OfferCardProps) => {
  const { user } = useAuth();
  const [items, setItems] = useState<OfferItem[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);

  const isSender = user?.id === offer.sender_id;
  const isReceiver = user?.id === offer.receiver_id;
  const myConfirmed = isSender ? offer.sender_confirmed : offer.receiver_confirmed;

  useEffect(() => {
    supabase
      .from("trade_offer_items")
      .select("id, record_id, owner_id")
      .eq("offer_id", offer.id)
      .then(async ({ data }) => {
        if (!data) return;
        const enriched = await Promise.all(
          data.map(async (item) => {
            const { data: rec } = await supabase
              .from("user_records")
              .select("title, artist, cover_image")
              .eq("id", item.record_id)
              .single();
            return { ...item, record: rec || undefined };
          })
        );
        setItems(enriched);
      });

    if (user && offer.status === "completed") {
      supabase
        .from("user_reviews")
        .select("id")
        .eq("offer_id", offer.id)
        .eq("reviewer_id", user.id)
        .then(({ data }) => setHasReviewed(!!(data && data.length > 0)));
    }
  }, [offer.id, offer.status, user]);

  const handleAccept = async () => {
    await supabase.from("trade_offers").update({ status: "accepted" }).eq("id", offer.id);
    onUpdate();
  };

  const handleDecline = async () => {
    await supabase.from("trade_offers").update({ status: "declined" }).eq("id", offer.id);
    onUpdate();
  };

  const handleConfirmComplete = async () => {
    const updates: any = {};
    if (isSender) updates.sender_confirmed = true;
    if (isReceiver) updates.receiver_confirmed = true;

    const bothConfirmed =
      (isSender && offer.receiver_confirmed) || (isReceiver && offer.sender_confirmed);

    if (bothConfirmed) {
      updates.status = "completed";
    }

    await supabase.from("trade_offers").update(updates).eq("id", offer.id);

    // Mark records the current user offered (and owns) as "sold" so they
    // appear in the Sold filter of the Collection tab. RLS only permits
    // owners to update their own records, so each side updates their own
    // half of the trade when they confirm.
    if (user) {
      const myRecordIds = items
        .filter((i) => i.owner_id === user.id)
        .map((i) => i.record_id);
      if (myRecordIds.length > 0) {
        await supabase
          .from("user_records")
          .update({ status: "sold" } as any)
          .in("id", myRecordIds);
      }
    }

    onUpdate();
  };

  const handleSubmitReview = async () => {
    if (!user || rating === 0) return;
    setSubmittingReview(true);
    const reviewedId = isSender ? offer.receiver_id : offer.sender_id;
    await supabase.from("user_reviews").insert({
      offer_id: offer.id,
      reviewer_id: user.id,
      reviewed_id: reviewedId,
      rating,
      review_text: reviewText || null,
    });

    // If both participants have now reviewed each other, auto-archive the chat for both.
    const { data: allReviews } = await supabase
      .from("user_reviews")
      .select("reviewer_id")
      .eq("offer_id", offer.id);
    const reviewerIds = new Set((allReviews || []).map((r: any) => r.reviewer_id));
    if (reviewerIds.has(offer.sender_id) && reviewerIds.has(offer.receiver_id)) {
      const { data: offerRow } = await supabase
        .from("trade_offers")
        .select("chat_id")
        .eq("id", offer.id)
        .single();
      if (offerRow?.chat_id) {
        const { data: chatRow } = await supabase
          .from("chats")
          .select("archived_by")
          .eq("id", offerRow.chat_id)
          .single();
        const existing: string[] = (chatRow as any)?.archived_by || [];
        const merged = Array.from(new Set([...existing, offer.sender_id, offer.receiver_id]));
        await supabase
          .from("chats")
          .update({ archived_by: merged } as any)
          .eq("id", offerRow.chat_id);
      }
    }

    setSubmittingReview(false);
    setHasReviewed(true);
    setShowReview(false);
    onUpdate();
  };

  const senderItems = items.filter((i) => i.owner_id === offer.sender_id);
  const receiverItems = items.filter((i) => i.owner_id === offer.receiver_id);

  const RecordPill = ({ item }: { item: OfferItem }) => (
    <div className="flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1">
      <div className="h-7 w-7 shrink-0 overflow-hidden rounded bg-card">
        {item.record?.cover_image ? (
          <img src={item.record.cover_image} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">♪</div>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate font-body text-[10px] font-semibold text-foreground">{item.record?.title || "Unknown"}</p>
        <p className="truncate font-body text-[9px] text-muted-foreground">{item.record?.artist || ""}</p>
      </div>
    </div>
  );

  const SideSection = ({ label, sideItems, cash }: { label: string; sideItems: OfferItem[]; cash: number }) => (
    (sideItems.length > 0 || cash > 0) ? (
      <div className="mb-2">
        <p className="mb-1 font-body text-[9px] font-semibold text-muted-foreground uppercase">{label}</p>
        <div className="space-y-1">
          {sideItems.map((item) => <RecordPill key={item.id} item={item} />)}
          {cash > 0 && (
            <div className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1.5">
              <span className="font-body text-xs font-semibold text-primary">₪{cash}</span>
            </div>
          )}
        </div>
      </div>
    ) : null
  );

  return (
    <div className="rounded-xl border border-border bg-card p-3 vinyl-shadow">
      <div className="mb-2 flex items-center gap-1.5">
        <ArrowRightLeft size={12} className="text-primary" />
        <span className="font-body text-[10px] font-bold uppercase tracking-wider text-primary">
          {offer.status === "pending" ? "Offer" : offer.status === "accepted" ? "Accepted" : offer.status === "completed" ? "Completed" : "Declined"}
        </span>
      </div>

      <SideSection
        label={isSender ? "You will give" : `You will receive from ${senderName}`}
        sideItems={senderItems}
        cash={offer.sender_cash}
      />

      <SideSection
        label={isReceiver ? "You will give" : `You will receive from ${receiverName}`}
        sideItems={receiverItems}
        cash={offer.receiver_cash}
      />

      {/* Actions */}
      {offer.status === "pending" && isReceiver && (
        <div className="space-y-2 mt-2">
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAccept} className="flex-1 gap-1 font-body text-xs">
              <Check size={14} /> Accept
            </Button>
            <Button size="sm" variant="outline" onClick={handleDecline} className="flex-1 gap-1 font-body text-xs">
              <X size={14} /> Decline
            </Button>
          </div>
          {onCounterOffer && (
            <Button size="sm" variant="secondary" onClick={onCounterOffer} className="w-full gap-1 font-body text-xs">
              <ArrowRightLeft size={14} /> Counter Offer
            </Button>
          )}
        </div>
      )}

      {offer.status === "pending" && isSender && (
        <div className="space-y-2 mt-2">
          <p className="text-center font-body text-[10px] text-muted-foreground">Waiting for response...</p>
          {onCounterOffer && (
            <Button size="sm" variant="secondary" onClick={onCounterOffer} className="w-full gap-1 font-body text-xs">
              <ArrowRightLeft size={14} /> Change Offer
            </Button>
          )}
        </div>
      )}

      {offer.status === "accepted" && !myConfirmed && (
        <Button size="sm" onClick={handleConfirmComplete} className="mt-2 w-full gap-1 font-body text-xs">
          <Check size={14} /> Sale / Trade Complete
        </Button>
      )}

      {offer.status === "accepted" && myConfirmed && (
        <p className="mt-2 text-center font-body text-[10px] text-muted-foreground">
          Waiting for other party to confirm...
        </p>
      )}

      {offer.status === "completed" && !hasReviewed && !showReview && (
        <Button size="sm" variant="secondary" onClick={() => setShowReview(true)} className="mt-2 w-full gap-1 font-body text-xs">
          <Star size={14} /> Leave a Review
        </Button>
      )}

      {offer.status === "completed" && hasReviewed && (
        <p className="mt-2 text-center font-body text-[10px] text-muted-foreground">✓ Review submitted</p>
      )}

      {showReview && (
        <div className="mt-3 space-y-2 rounded-lg bg-muted p-3">
          <p className="font-body text-xs font-semibold text-foreground">Rate your experience</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} onClick={() => setRating(s)}>
                <Star
                  size={22}
                  className={s <= rating ? "fill-primary text-primary" : "text-muted-foreground"}
                />
              </button>
            ))}
          </div>
          <Textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="Write a review (optional)..."
            className="min-h-[60px] font-body text-xs"
          />
          <Button
            size="sm"
            onClick={handleSubmitReview}
            disabled={rating === 0 || submittingReview}
            className="w-full font-body text-xs"
          >
            {submittingReview ? "Submitting..." : "Submit Review"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default OfferCard;
