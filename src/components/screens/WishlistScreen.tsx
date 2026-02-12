import { useState } from "react";
import { Heart, Plus, LayoutGrid, List, RefreshCw } from "lucide-react";
import { useUserWishlist, useDiscogsProfile, useDiscogsSync } from "@/hooks/useDiscogs";
import AddRecordDialog from "@/components/AddRecordDialog";

const WishlistScreen = () => {
  const [view, setView] = useState<"grid" | "list">("list");
  const [addOpen, setAddOpen] = useState(false);
  const { data: wishlist = [], isLoading } = useUserWishlist();
  const { data: profile } = useDiscogsProfile();
  const { syncWishlist } = useDiscogsSync();

  return (
    <div className="px-4 pt-4 pb-2">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-foreground">Wishlist</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView(view === "grid" ? "list" : "grid")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary"
          >
            {view === "grid" ? <List size={18} /> : <LayoutGrid size={18} />}
          </button>
          {profile?.discogs_connected && (
            <button
              onClick={() => syncWishlist.mutate()}
              disabled={syncWishlist.isPending}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary"
            >
              <RefreshCw size={18} className={syncWishlist.isPending ? "animate-spin" : ""} />
            </button>
          )}
          <button
            onClick={() => setAddOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>
      <p className="mb-4 font-body text-xs text-muted-foreground">{wishlist.length} records wanted</p>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : wishlist.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <Heart size={48} className="mb-4 text-muted-foreground/40" />
          <p className="font-body text-sm text-muted-foreground">No wishlist items yet</p>
          <p className="mt-1 font-body text-xs text-muted-foreground/60">
            {profile?.discogs_connected
              ? "Tap the sync button to import from Discogs"
              : "Connect your Discogs account in Profile to import"}
          </p>
        </div>
      ) : view === "list" ? (
        <div className="space-y-3">
          {wishlist.map((item) => (
            <div key={item.id} className="flex items-center gap-4 rounded-xl bg-card p-4 vinyl-shadow">
              {item.cover_image ? (
                <img src={item.cover_image} alt={item.title} className="h-12 w-12 rounded-lg object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/15">
                  <Heart size={20} className="text-primary" fill="hsl(var(--primary))" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-sm font-semibold text-foreground truncate">{item.title}</h3>
                <p className="font-body text-xs text-muted-foreground truncate">{item.artist}{item.year ? ` · ${item.year}` : ""}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {wishlist.map((item) => (
            <div key={item.id} className="group rounded-xl bg-card p-2.5 vinyl-shadow transition-transform hover:scale-[1.02]">
              <div className="mb-2 flex aspect-square items-center justify-center rounded-lg bg-primary/10 overflow-hidden">
                {item.cover_image ? (
                  <img src={item.cover_image} alt={item.title} className="h-full w-full object-cover" />
                ) : (
                  <Heart size={36} className="text-primary transition-transform group-hover:scale-110" fill="hsl(var(--primary))" />
                )}
              </div>
              <h3 className="font-display text-xs font-semibold leading-tight text-foreground truncate">{item.title}</h3>
              <p className="mt-0.5 font-body text-[10px] text-muted-foreground truncate">{item.artist}</p>
              <div className="mt-2">
                <span className="font-body text-xs text-muted-foreground">{item.year || "—"}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddRecordDialog open={addOpen} onOpenChange={setAddOpen} target="wishlist" />
    </div>
  );
};

export default WishlistScreen;
