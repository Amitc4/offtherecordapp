/**
 * @file DiscoverScreen.tsx — Browse records listed for sale / trade by other users.
 *
 * **Features:**
 * - **Search bar** – Filter by title or artist name.
 * - **Genre chips** – Quick-filter by genre (Rock, Jazz, Soul, etc.).
 * - **Grid / List toggle** – Switch between card grid and compact list view.
 * - **Location-based distance** – If the user grants location permission,
 *   each listing shows how far away the seller is (e.g. "2.3 km away").
 * - **Blocked-user filtering** – Records from blocked users are hidden.
 * - **Contact seller** – Opens (or creates) a chat with a pre-filled message.
 *
 * Data is fetched from `user_records` where `status = 'for_sale'`, excluding
 * the current user's own records and any blocked users' records.
 *
 * @see DiscoverRecordSheet – Bottom sheet shown when a record card is tapped.
 */
import { useState, useMemo, useEffect } from "react";
import { Disc3, Search, MapPin, Sparkles } from "lucide-react";
import ViewToggle from "@/components/ViewToggle";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import DiscoverRecordSheet from "@/components/DiscoverRecordSheet";
import { toast } from "sonner";
import { useLocation, getDistanceKm } from "@/hooks/useLocation";

/** List of genre filter options shown as horizontal chips. */
const GENRES = ["All", "Rock", "Jazz", "Soul", "Electronic", "Hip Hop", "Pop", "Classical", "Funk", "R&B"];

interface DiscoverScreenProps {
  onNavigateToChat: (chatId: number, draftMessage?: string) => void;
}

const DiscoverScreen = ({ onNavigateToChat }: DiscoverScreenProps) => {
  const { user } = useAuth();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [searchText, setSearchText] = useState("");
  const [activeGenre, setActiveGenre] = useState("All");
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const { latitude, longitude, permissionGranted, requestLocation } = useLocation();

  // Fetch seller profiles for distance calculation
  const { data: sellerProfiles = {} } = useQuery({
    queryKey: ["seller_profiles_location"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, latitude, longitude");
      const map: Record<string, { latitude: number | null; longitude: number | null }> = {};
      (data || []).forEach((p: any) => { map[p.user_id] = { latitude: p.latitude, longitude: p.longitude }; });
      return map;
    },
    enabled: !!user && permissionGranted,
  });

  // Fetch blocked users to filter them out
  const { data: blockedUserIds = [] } = useQuery({
    queryKey: ["blocked_users", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_blocks")
        .select("blocked_id")
        .eq("blocker_id", user!.id);
      return (data || []).map((b: any) => b.blocked_id);
    },
    enabled: !!user,
  });

  // Check if the current user has Spotify connected
  const { data: spotifyConnected = false } = useQuery({
    queryKey: ["spotify_connected", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("spotify_connected")
        .eq("user_id", user!.id)
        .single();
      return !!(data as any)?.spotify_connected;
    },
    enabled: !!user,
  });

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["discover_records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_records")
        .select("*")
        .eq("status", "for_sale")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Spotify-personalized recommendations (only loaded when connected & on "All" tab)
  const { data: spotifyRecs = [], isLoading: spotifyLoading } = useQuery({
    queryKey: ["discover_spotify_recs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("spotify-recommendations", { body: {} });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      return (data?.recommendations || []) as any[];
    },
    enabled: !!user && spotifyConnected,
    staleTime: 5 * 60 * 1000,
  });

  const useSpotifyRecs = activeGenre === "All" && spotifyConnected && spotifyRecs.length > 0;

  const filtered = useMemo(() => {
    const base = useSpotifyRecs ? spotifyRecs : records;
    let items = base.filter((r: any) => r.user_id !== user?.id && !blockedUserIds.includes(r.user_id));

    if (!useSpotifyRecs && activeGenre !== "All") {
      items = items.filter((r: any) => {
        const genre = (r.genre || "").toLowerCase();
        return genre.includes(activeGenre.toLowerCase());
      });
    }

    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      items = items.filter(
        (r: any) =>
          r.title.toLowerCase().includes(q) ||
          r.artist.toLowerCase().includes(q)
      );
    }

    return items;
  }, [records, spotifyRecs, useSpotifyRecs, user?.id, activeGenre, searchText, blockedUserIds]);

  const getDistance = (sellerId: string): string | null => {
    if (!latitude || !longitude || !permissionGranted) return null;
    const seller = sellerProfiles[sellerId];
    if (!seller?.latitude || !seller?.longitude) return null;
    const dist = getDistanceKm(latitude, longitude, seller.latitude, seller.longitude);
    if (dist < 1) return `${Math.round(dist * 1000)}m away`;
    return `${dist.toFixed(1)}km away`;
  };

  const handleContactSeller = async (record: any, sellerName: string) => {
    if (!user) return;

    try {
      const { data: existingChats } = await supabase
        .from("chats")
        .select("id")
        .eq("record_id", record.id)
        .or(`and(participant_1.eq.${user.id},participant_2.eq.${record.user_id}),and(participant_1.eq.${record.user_id},participant_2.eq.${user.id})`);

      const draftText = `Hi! I'm interested in "${record.title}" by ${record.artist}. Is it still available?`;

      if (existingChats && existingChats.length > 0) {
        setSelectedRecord(null);
        onNavigateToChat(existingChats[0].id, draftText);
        return;
      }

      const { data: newChat, error } = await supabase
        .from("chats")
        .insert({
          participant_1: user.id,
          participant_2: record.user_id,
          record_id: record.id,
          record_title: record.title,
        })
        .select("id")
        .single();

      if (error) throw error;

      setSelectedRecord(null);
      onNavigateToChat(newChat.id, draftText);
    } catch (err) {
      console.error(err);
      toast.error("Failed to start conversation");
    }
  };

  return (
    <div className="px-4 pt-4 pb-2">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-foreground">Discover</h1>
      </div>
      <p className="mb-3 font-body text-sm text-muted-foreground">Find your next favourite record</p>

      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={requestLocation}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-body text-xs font-medium transition-colors ${
            permissionGranted
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          <MapPin size={14} />
          {permissionGranted ? "Location on" : "Enable location"}
        </button>
        <ViewToggle view={view} onChange={setView} />
      </div>

      {/* Search bar */}
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search by title or artist..."
          className="h-10 pl-9 font-body text-sm"
        />
      </div>

      {/* Genre filters */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {GENRES.map((genre) => (
          <button
            key={genre}
            onClick={() => setActiveGenre(genre)}
            className={`shrink-0 rounded-full px-4 py-2 font-body text-xs font-medium transition-colors ${
              activeGenre === genre
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-primary/10 text-primary hover:bg-primary/20"
            }`}
          >
            {genre}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Search size={48} className="mb-4 text-muted-foreground/40" />
          <p className="font-display text-base font-semibold text-muted-foreground">
            No available records that match your search
          </p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-2.5">
          {filtered.map((item) => {
            const price = (item as any).price as number | null;
            const distance = getDistance(item.user_id);
            return (
              <div
                key={item.id}
                onClick={() => setSelectedRecord(item)}
                className="group cursor-pointer rounded-xl bg-card p-2.5 vinyl-shadow transition-transform hover:scale-[1.02]"
              >
                <div className="mb-2 flex aspect-square items-center justify-center rounded-lg bg-primary/10 overflow-hidden">
                  {item.cover_image ? (
                    <img src={item.cover_image} alt={item.title} className="h-full w-full object-cover" />
                  ) : (
                    <Disc3 size={36} className="text-primary transition-transform group-hover:rotate-45" />
                  )}
                </div>
                <h3 className="font-display text-sm font-semibold leading-tight text-foreground truncate">{item.title}</h3>
                <p className="mt-0.5 font-display text-xs text-muted-foreground truncate">{item.artist}</p>
                <div className="mt-2 flex items-center justify-between">
                  {price != null ? (
                    <span className="font-body text-sm font-bold text-primary">₪{price}</span>
                  ) : (
                    <span className="font-body text-xs text-muted-foreground">{item.year || "—"}</span>
                  )}
                  {item.condition && (
                    <span className="rounded bg-secondary px-1.5 py-0.5 font-body text-[9px] font-semibold text-secondary-foreground">
                      {item.condition}
                    </span>
                  )}
                </div>
                {distance && (
                  <p className="mt-1 flex items-center gap-1 font-body text-[10px] text-muted-foreground">
                    <MapPin size={9} /> {distance}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const price = (item as any).price as number | null;
            const distance = getDistance(item.user_id);
            return (
              <div
                key={item.id}
                onClick={() => setSelectedRecord(item)}
                className="flex cursor-pointer items-center gap-4 rounded-xl bg-card p-4 vinyl-shadow"
              >
                {item.cover_image ? (
                  <img src={item.cover_image} alt={item.title} className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/15">
                    <Disc3 size={24} className="text-primary" fill="hsl(var(--primary) / 0.2)" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-base font-semibold text-foreground truncate">{item.title}</h3>
                  <p className="font-display text-sm text-muted-foreground">{item.artist}</p>
                  {distance && (
                    <p className="flex items-center gap-1 font-body text-[10px] text-muted-foreground">
                      <MapPin size={9} /> {distance}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  {price != null && (
                    <span className="font-body text-sm font-bold text-primary">₪{price}</span>
                  )}
                  {item.condition && (
                    <span className="rounded bg-secondary px-1.5 py-0.5 font-body text-[9px] font-semibold text-secondary-foreground">
                      {item.condition}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DiscoverRecordSheet
        record={selectedRecord}
        open={!!selectedRecord}
        onOpenChange={(open) => !open && setSelectedRecord(null)}
        onContactSeller={handleContactSeller}
      />
    </div>
  );
};

export default DiscoverScreen;
