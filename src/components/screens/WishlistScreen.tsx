import { useState } from "react";
import { Heart, LayoutGrid, List } from "lucide-react";

const wishlist = [
  { id: 1, title: "In Rainbows", artist: "Radiohead", year: 2007, nearby: 3 },
  { id: 2, title: "Blonde", artist: "Frank Ocean", year: 2016, nearby: 7 },
  { id: 3, title: "Vespertine", artist: "Björk", year: 2001, nearby: 1 },
];

const WishlistScreen = () => {
  const [view, setView] = useState<"grid" | "list">("list");

  return (
    <div className="px-4 pt-4 pb-2">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-foreground">Wishlist</h1>
        <button
          onClick={() => setView(view === "grid" ? "list" : "grid")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary"
        >
          {view === "grid" ? <List size={18} /> : <LayoutGrid size={18} />}
        </button>
      </div>
      <p className="mb-4 font-body text-xs text-muted-foreground">{wishlist.length} records wanted</p>

      {view === "list" ? (
        <div className="space-y-3">
          {wishlist.map((item) => (
            <div key={item.id} className="flex items-center gap-4 rounded-xl bg-card p-4 vinyl-shadow">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/15">
                <Heart size={20} className="text-primary" fill="hsl(var(--primary))" />
              </div>
              <div className="flex-1">
                <h3 className="font-display text-sm font-semibold text-foreground">{item.title}</h3>
                <p className="font-body text-xs text-muted-foreground">{item.artist} · {item.year}</p>
              </div>
              <div className="flex flex-col items-end">
                <span className="font-body text-sm font-bold text-primary">{item.nearby}</span>
                <span className="font-body text-[10px] text-muted-foreground">nearby</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {wishlist.map((item) => (
            <div key={item.id} className="group rounded-xl bg-card p-2.5 vinyl-shadow transition-transform hover:scale-[1.02]">
              <div className="mb-2 flex aspect-square items-center justify-center rounded-lg bg-primary/10">
                <Heart size={36} className="text-primary transition-transform group-hover:scale-110" fill="hsl(var(--primary))" />
              </div>
              <h3 className="font-display text-xs font-semibold leading-tight text-foreground">{item.title}</h3>
              <p className="mt-0.5 font-body text-[10px] text-muted-foreground">{item.artist}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-body text-xs text-muted-foreground">{item.year}</span>
                <span className="font-body text-[10px] font-bold text-primary">{item.nearby} nearby</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WishlistScreen;
