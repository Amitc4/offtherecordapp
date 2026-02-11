import { Heart } from "lucide-react";

const wishlist = [
  { id: 1, title: "In Rainbows", artist: "Radiohead", year: 2007 },
  { id: 2, title: "Blonde", artist: "Frank Ocean", year: 2016 },
  { id: 3, title: "Vespertine", artist: "Björk", year: 2001 },
];

const WishlistScreen = () => {
  return (
    <div className="px-4 pt-6">
      <h1 className="mb-6 font-display text-2xl font-bold text-foreground">Wishlist</h1>
      <p className="mb-6 font-body text-sm text-muted-foreground">{wishlist.length} records wanted</p>

      <div className="space-y-3">
        {wishlist.map((item) => (
          <div key={item.id} className="flex items-center gap-4 rounded-xl bg-card p-4 vinyl-shadow">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Heart size={20} className="text-primary" fill="hsl(var(--primary))" />
            </div>
            <div className="flex-1">
              <h3 className="font-display text-sm font-semibold text-foreground">{item.title}</h3>
              <p className="font-body text-xs text-muted-foreground">{item.artist} · {item.year}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WishlistScreen;
