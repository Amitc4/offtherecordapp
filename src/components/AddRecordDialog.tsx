/**
 * @file AddRecordDialog.tsx — Dialog for adding a record to the collection or wishlist.
 *
 * Two modes (tabs):
 * 1. **Discogs Search** – Search the Discogs database by keyword, then tap "+" to add.
 *    Calls the `discogs` edge function with `action=search`.
 * 2. **Manual** – Enter title, artist, and year manually.
 *
 * The `target` prop determines which table the record is inserted into:
 * - `"collection"` → `user_records`
 * - `"wishlist"`   → `user_wishlist`
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Disc3, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface AddRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: "collection" | "wishlist";
}

interface DiscogsResult {
  id: number;
  title: string;
  year: number | null;
  cover_image: string | null;
  format: string | null;
  genre: string | null;
}

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discogs`;

const AddRecordDialog = ({ open, onOpenChange, target }: AddRecordDialogProps) => {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("search");

  // Search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DiscogsResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);

  // Manual state
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [year, setYear] = useState("");
  const [manualAdding, setManualAdding] = useState(false);

  const tableName = target === "collection" ? "user_records" : "user_wishlist";
  const queryKey = target === "collection" ? "user_records" : "user_wishlist";

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const resp = await fetch(
        `${FUNCTIONS_URL}?action=search&q=${encodeURIComponent(query)}`,
        {
          headers: {
            Authorization: `Bearer ${session!.access_token}`,
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      const data = await resp.json();
      setResults(data.results || []);
    } catch {
      toast.error("Search failed");
    } finally {
      setSearching(false);
    }
  };

  const addFromDiscogs = async (item: DiscogsResult) => {
    if (!user) return;
    setAdding(item.id);
    // Parse artist from "Artist - Title" format
    const parts = item.title.split(" - ");
    const artistName = parts.length > 1 ? parts[0].trim() : "Unknown";
    const titleName = parts.length > 1 ? parts.slice(1).join(" - ").trim() : item.title;

    const record: any = {
      user_id: user.id,
      title: titleName,
      artist: artistName,
      year: item.year,
      cover_image: item.cover_image,
      discogs_release_id: item.id,
      genre: item.genre,
    };
    if (target === "collection") {
      record.format = item.format;
    }

    const { error } = await supabase.from(tableName).insert(record);
    if (error) {
      toast.error("Failed to add record");
    } else {
      toast.success(`Added to ${target}`);
      queryClient.invalidateQueries({ queryKey: [queryKey] });
    }
    setAdding(null);
  };

  const addManual = async () => {
    if (!user || !title.trim() || !artist.trim()) return;
    setManualAdding(true);
    const record: any = {
      user_id: user.id,
      title: title.trim(),
      artist: artist.trim(),
      year: year ? parseInt(year) : null,
    };

    const { error } = await supabase.from(tableName).insert(record);
    if (error) {
      toast.error("Failed to add record");
    } else {
      toast.success(`Added to ${target}`);
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      setTitle("");
      setArtist("");
      setYear("");
      onOpenChange(false);
    }
    setManualAdding(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display">
            Add to {target === "collection" ? "Collection" : "Wishlist"}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="w-full">
            <TabsTrigger value="search" className="flex-1 font-body text-xs">
              <Search size={14} className="mr-1" /> Discogs Search
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex-1 font-body text-xs">
              <Plus size={14} className="mr-1" /> Manual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="flex-1 overflow-hidden flex flex-col mt-2">
            <div className="flex gap-2 mb-3">
              <Input
                placeholder="Search Discogs..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="font-body text-sm"
              />
              <Button size="sm" onClick={handleSearch} disabled={searching}>
                {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {results.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-lg bg-card p-3">
                  {item.cover_image ? (
                    <img src={item.cover_image} alt={item.title} className="h-10 w-10 rounded object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded bg-primary/10">
                      <Disc3 size={18} className="text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-xs font-medium text-foreground truncate">{item.title}</p>
                    <p className="font-body text-[10px] text-muted-foreground">{item.year || "—"}{item.format ? ` · ${item.format}` : ""}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addFromDiscogs(item)}
                    disabled={adding === item.id}
                    className="shrink-0"
                  >
                    {adding === item.id ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  </Button>
                </div>
              ))}
              {results.length === 0 && !searching && (
                <p className="py-8 text-center font-body text-xs text-muted-foreground">
                  Search the Discogs database to find records
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="manual" className="mt-2 space-y-3">
            <div>
              <Label className="font-body text-xs">Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="font-body text-sm" />
            </div>
            <div>
              <Label className="font-body text-xs">Artist *</Label>
              <Input value={artist} onChange={(e) => setArtist(e.target.value)} className="font-body text-sm" />
            </div>
            <div>
              <Label className="font-body text-xs">Year</Label>
              <Input value={year} onChange={(e) => setYear(e.target.value)} type="number" className="font-body text-sm" />
            </div>
            <Button onClick={addManual} disabled={manualAdding || !title.trim() || !artist.trim()} className="w-full">
              {manualAdding ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Plus size={16} className="mr-2" />}
              Add Record
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AddRecordDialog;
