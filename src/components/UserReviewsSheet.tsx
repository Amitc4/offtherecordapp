/**
 * @file UserReviewsSheet.tsx — Bottom sheet listing all reviews a user has received.
 * Shows the reviewer's name, star rating, optional written feedback, and date.
 */
import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";

interface Review {
  id: string;
  reviewer_id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  reviewer_name?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  averageRating: number;
  totalReviews: number;
}

const UserReviewsSheet = ({ open, onOpenChange, userId, averageRating, totalReviews }: Props) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("user_reviews")
        .select("id, reviewer_id, rating, review_text, created_at")
        .eq("reviewed_id", userId)
        .order("created_at", { ascending: false });
      const rows = (data || []) as Review[];
      const ids = [...new Set(rows.map((r) => r.reviewer_id))];
      let nameMap: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name, nickname")
          .in("user_id", ids);
        (profs || []).forEach((p: any) => {
          nameMap[p.user_id] = p.nickname || p.display_name || "User";
        });
      }
      setReviews(rows.map((r) => ({ ...r, reviewer_name: nameMap[r.reviewer_id] || "User" })));
      setLoading(false);
    })();
  }, [open, userId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="font-display text-xl text-foreground">Reviews</SheetTitle>
        </SheetHeader>

        <div className="mt-4 mb-4 flex items-center gap-3 rounded-xl bg-card p-4 vinyl-shadow">
          <div className="flex flex-col items-center">
            <span className="font-display text-3xl font-bold text-foreground">
              {totalReviews > 0 ? averageRating.toFixed(1) : "—"}
            </span>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  size={12}
                  className={s <= Math.round(averageRating) ? "fill-primary text-primary" : "text-muted-foreground"}
                />
              ))}
            </div>
          </div>
          <p className="font-body text-sm text-muted-foreground">
            Based on {totalReviews} {totalReviews === 1 ? "review" : "reviews"}
          </p>
        </div>

        {loading ? (
          <p className="py-8 text-center font-body text-sm text-muted-foreground">Loading...</p>
        ) : reviews.length === 0 ? (
          <p className="py-8 text-center font-body text-sm text-muted-foreground">No reviews yet.</p>
        ) : (
          <div className="space-y-3 pb-6">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-xl bg-card p-4 vinyl-shadow">
                <div className="mb-1 flex items-center justify-between">
                  <p className="font-body text-sm font-semibold text-foreground">{r.reviewer_name}</p>
                  <p className="font-body text-[10px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="mb-2 flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={13}
                      className={s <= r.rating ? "fill-primary text-primary" : "text-muted-foreground"}
                    />
                  ))}
                </div>
                {r.review_text && (
                  <p className="font-body text-sm text-foreground whitespace-pre-wrap">{r.review_text}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default UserReviewsSheet;
