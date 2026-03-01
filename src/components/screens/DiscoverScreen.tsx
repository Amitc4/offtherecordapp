import { useState, useMemo } from "react";
import { Disc3, Search } from "lucide-react";
import ViewToggle from "@/components/ViewToggle";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import DiscoverRecordSheet from "@/components/DiscoverRecordSheet";
import { toast } from "sonner";

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

  const filtered = useMemo(() => {
    let items = records.filter((r) => r.user_id !== user?.id);

    if (activeGenre !== "All") {
      items = items.filter((r) => {
        const genre = ((r as any).genre || "").toLowerCase();
        return genre.includes(activeGenre.toLowerCase());
      });
    }

    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      items = items.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.artist.toLowerCase().includes(q)
      );
    }

    return items;
  }, [records, user?.id, activeGenre, searchText]);

  const handleContactSeller = async (record: any, sellerName: string) => {
    if (!user) return;

    try {
      // Check if a chat already exists between these users about this record
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

      // Create a new chat
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

      <div className="mb-3 flex justify-end">
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
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const price = (item as any).price as number | null;
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
