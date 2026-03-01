import { useState } from "react";
import { Heart, Plus, RefreshCw, CheckSquare, X, Trash2 } from "lucide-react";
import ViewToggle from "@/components/ViewToggle";
import { useUserWishlist, useDiscogsProfile, useDiscogsSync } from "@/hooks/useDiscogs";
import AddRecordDialog from "@/components/AddRecordDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const WishlistScreen = () => {
  const [view, setView] = useState<"grid" | "list">("list");
  const [addOpen, setAddOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [detailItem, setDetailItem] = useState<any>(null);
  const [singleRemoveOpen, setSingleRemoveOpen] = useState(false);

  const { data: wishlist = [], isLoading } = useUserWishlist();
  const { data: profile } = useDiscogsProfile();
  const { syncWishlist } = useDiscogsSync();
  const queryClient = useQueryClient();

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const handleBulkRemove = async () => {
    if (selected.size === 0) return;
    setRemoving(true);
    const ids = Array.from(selected);
    const { error } = await supabase
      .from("user_wishlist")
      .delete()
      .in("id", ids);
    if (error) {
      toast.error("Failed to remove items");
    } else {
      toast.success(`${ids.length} item${ids.length > 1 ? "s" : ""} removed from wishlist`);
      queryClient.invalidateQueries({ queryKey: ["user_wishlist"] });
    }
    setRemoving(false);
    setRemoveConfirmOpen(false);
    exitSelectMode();
  };

  const handleSingleRemove = async () => {
    if (!detailItem) return;
    const { error } = await supabase
      .from("user_wishlist")
      .delete()
      .eq("id", detailItem.id);
    if (error) {
      toast.error("Failed to remove item");
    } else {
      toast.success("Removed from wishlist");
      queryClient.invalidateQueries({ queryKey: ["user_wishlist"] });
      setDetailItem(null);
    }
    setSingleRemoveOpen(false);
  };

  return (
    <div className="px-4 pt-4 pb-2">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-foreground">Wishlist</h1>
        <div className="flex items-center gap-2">
          {!selectMode ? (
            <>
              {wishlist.length > 0 && (
                <button
                  onClick={() => setSelectMode(true)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary active:scale-95"
                >
                  <CheckSquare size={18} />
                </button>
              )}
              {profile?.discogs_connected && (
                <button
                  onClick={() => syncWishlist.mutate()}
                  disabled={syncWishlist.isPending}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary active:scale-95"
                >
                  <RefreshCw size={18} className={syncWishlist.isPending ? "animate-spin" : ""} />
                </button>
              )}
              <button
                onClick={() => setAddOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-95"
              >
                <Plus size={18} />
              </button>
            </>
          ) : (
            <button
              onClick={exitSelectMode}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-95"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {!selectMode && (
        <div className="mb-4 flex justify-end">
          <ViewToggle view={view} onChange={setView} />
        </div>
      )}

      {selectMode ? (
        <p className="mb-4 font-body text-xs text-primary font-medium">
          {selected.size} selected · tap records to select
        </p>
      ) : (
        <p className="mb-4 font-body text-sm text-muted-foreground">{wishlist.length} records wanted</p>
      )}

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
          {wishlist.map((item) => {
            const isSelected = selected.has(item.id);
            return (
              <div
                key={item.id}
                onClick={() => selectMode ? toggleSelect(item.id) : setDetailItem(item)}
                className={`flex items-center gap-4 rounded-xl p-4 vinyl-shadow transition-all cursor-pointer ${isSelected ? "bg-primary/10 ring-2 ring-primary/40" : "bg-card"}`}
              >
                {selectMode && (
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                    isSelected ? "border-primary bg-primary" : "border-muted-foreground/30 bg-card"
                  }`}>
                    {isSelected && <CheckSquare size={14} className="text-primary-foreground" />}
                  </div>
                )}
                {item.cover_image ? (
                  <img src={item.cover_image} alt={item.title} className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/15">
                    <Heart size={20} className="text-primary" fill="hsl(var(--primary))" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-base font-semibold text-foreground truncate">{item.title}</h3>
                  <p className="font-display text-sm text-muted-foreground truncate">{item.artist}{item.year ? ` · ${item.year}` : ""}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {wishlist.map((item) => {
            const isSelected = selected.has(item.id);
            return (
              <div
                key={item.id}
                onClick={() => selectMode ? toggleSelect(item.id) : setDetailItem(item)}
                className={`group rounded-xl p-2.5 vinyl-shadow transition-all cursor-pointer ${
                  selectMode ? "" : "hover:scale-[1.02]"
                } ${isSelected ? "bg-primary/10 ring-2 ring-primary/40" : "bg-card"}`}
              >
                <div className="relative mb-2 flex aspect-square items-center justify-center rounded-lg bg-primary/10 overflow-hidden">
                  {selectMode && (
                    <div className={`absolute top-1.5 left-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-md border-2 transition-colors ${
                      isSelected ? "border-primary bg-primary" : "border-white/60 bg-black/30"
                    }`}>
                      {isSelected && <CheckSquare size={14} className="text-primary-foreground" />}
                    </div>
                  )}
                  {item.cover_image ? (
                    <img src={item.cover_image} alt={item.title} className="h-full w-full object-cover" />
                  ) : (
                    <Heart size={36} className="text-primary transition-transform group-hover:scale-110" fill="hsl(var(--primary))" />
                  )}
                </div>
                <h3 className="font-display text-sm font-semibold leading-tight text-foreground truncate">{item.title}</h3>
                <p className="mt-0.5 font-display text-xs text-muted-foreground truncate">{item.artist}</p>
                <div className="mt-2">
                  <span className="font-body text-xs text-muted-foreground">{item.year || "—"}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating remove button in select mode */}
      <AnimatePresence>
        {selectMode && selected.size > 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2"
          >
            <button
              onClick={() => setRemoveConfirmOpen(true)}
              disabled={removing}
              className="flex items-center gap-2 rounded-full bg-destructive px-5 py-3 font-body text-sm font-semibold text-destructive-foreground shadow-lg active:scale-95"
            >
              <Trash2 size={16} />
              Remove from Wishlist ({selected.size})
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk remove confirmation */}
      <AlertDialog open={removeConfirmOpen} onOpenChange={setRemoveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Wishlist</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {selected.size} item{selected.size > 1 ? "s" : ""} from your wishlist? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleBulkRemove}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Wishlist item detail sheet */}
      <Sheet open={!!detailItem} onOpenChange={(open) => !open && setDetailItem(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl border-t border-border bg-card px-0 pb-8">
          <SheetHeader className="px-5 pb-2">
            <SheetTitle className="font-display text-lg text-foreground">Wishlist Item</SheetTitle>
          </SheetHeader>
          {detailItem && (
            <div className="px-5 space-y-5">
              <div className="flex gap-4">
                <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-primary/10">
                  {detailItem.cover_image ? (
                    <img src={detailItem.cover_image} alt={detailItem.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Heart size={48} className="text-primary" fill="hsl(var(--primary) / 0.2)" />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col justify-center min-w-0">
                  <h2 className="font-display text-base font-bold text-foreground leading-tight">{detailItem.title}</h2>
                  <p className="mt-1 font-body text-sm text-muted-foreground">{detailItem.artist}</p>
                  {detailItem.year && (
                    <span className="mt-2 font-body text-xs text-muted-foreground">{detailItem.year}</span>
                  )}
                </div>
              </div>

              {detailItem.notes && (
                <div>
                  <p className="mb-1 font-body text-xs font-medium text-muted-foreground">Notes</p>
                  <p className="font-body text-sm text-foreground">{detailItem.notes}</p>
                </div>
              )}

              {/* Remove from wishlist */}
              <AlertDialog open={singleRemoveOpen} onOpenChange={setSingleRemoveOpen}>
                <button
                  onClick={() => setSingleRemoveOpen(true)}
                  className="flex w-full items-center gap-3 rounded-xl bg-destructive/10 p-4 transition-colors active:bg-destructive/20"
                >
                  <Trash2 size={18} className="text-destructive" />
                  <p className="font-body text-sm font-medium text-destructive">Remove from Wishlist</p>
                </button>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove from Wishlist</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to remove "{detailItem.title}" from your wishlist?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={handleSingleRemove}
                    >
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AddRecordDialog open={addOpen} onOpenChange={setAddOpen} target="wishlist" />
    </div>
  );
};

export default WishlistScreen;
