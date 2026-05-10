/**
 * @file SpotifyRecommendationsSheet.tsx — Shows records on the marketplace
 * matched to the user's Spotify top artists / genres.
 */
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { Music, Disc3 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Rec {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  cover_image: string | null;
  price: number | null;
  condition: string | null;
  format: string | null;
  _score: number;
}

const SpotifyRecommendationsSheet = ({ open, onOpenChange }: Props) => {
  const [loading, setLoading] = useState(false);
  const [topArtists, setTopArtists] = useState<string[]>([]);
  const [topGenres, setTopGenres] = useState<string[]>([]);
  const [recs, setRecs] = useState<Rec[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    supabase.functions
      .invoke("spotify-recommendations", { body: {} })
      .then(({ data, error }) => {
        if (error || data?.error) {
          setError(data?.error || error?.message || "Failed to load recommendations");
        } else {
          setTopArtists(data.top_artists || []);
          setTopGenres(data.top_genres || []);
          setRecs(data.recommendations || []);
        }
      })
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl bg-card pb-8 max-h-[85vh] overflow-y-auto">
        <SheetHeader className="pb-3">
          <SheetTitle className="font-display text-lg flex items-center gap-2">
            <Music size={18} className="text-primary" />
            Recommended for You
          </SheetTitle>
        </SheetHeader>

        {loading && (
          <div className="flex flex-col items-center py-10 gap-3">
            <Disc3 size={32} className="animate-spin text-primary" />
            <p className="font-body text-sm text-muted-foreground">Analyzing your Spotify taste...</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-destructive/10 p-4 font-body text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-5">
            {topArtists.length > 0 && (
              <div>
                <p className="mb-2 font-body text-xs font-medium text-muted-foreground">
                  Your top artists on Spotify
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {topArtists.map((a) => (
                    <span key={a} className="rounded-full bg-primary/10 px-2.5 py-1 font-body text-[11px] font-semibold text-primary">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {topGenres.length > 0 && (
              <div>
                <p className="mb-2 font-body text-xs font-medium text-muted-foreground">
                  Your top genres
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {topGenres.map((g) => (
                    <span key={g} className="rounded-full bg-secondary px-2.5 py-1 font-body text-[11px] text-secondary-foreground">
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="mb-2 font-body text-xs font-medium text-muted-foreground">
                Records on the marketplace you might love ({recs.length})
              </p>
              {recs.length === 0 ? (
                <p className="font-body text-sm text-muted-foreground py-4 text-center">
                  No matching records for sale right now. Check back later!
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {recs.map((r) => (
                    <div key={r.id} className="rounded-xl bg-background overflow-hidden vinyl-shadow">
                      <div className="aspect-square bg-primary/10 relative">
                        {r.cover_image ? (
                          <img src={r.cover_image} alt={r.title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Disc3 size={40} className="text-primary" />
                          </div>
                        )}
                        {r._score >= 10 && (
                          <span className="absolute top-1.5 left-1.5 rounded-full bg-green-500 px-1.5 py-0.5 font-body text-[9px] font-bold text-white">
                            Top match
                          </span>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="font-body text-xs font-semibold text-foreground truncate">{r.title}</p>
                        <p className="font-body text-[11px] text-muted-foreground truncate">{r.artist}</p>
                        {r.price != null && (
                          <p className="mt-1 font-body text-xs font-bold text-primary">₪{r.price}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default SpotifyRecommendationsSheet;
