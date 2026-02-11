import { Disc3, ArrowRight } from "lucide-react";

const featured = [
  { id: 1, title: "The Dark Side of the Moon", artist: "Pink Floyd", price: "$35", condition: "VG+" },
  { id: 2, title: "Thriller", artist: "Michael Jackson", price: "$28", condition: "NM" },
  { id: 3, title: "Back to Black", artist: "Amy Winehouse", price: "$22", condition: "VG" },
  { id: 4, title: "OK Computer", artist: "Radiohead", price: "$40", condition: "NM" },
  { id: 5, title: "Purple Rain", artist: "Prince", price: "$30", condition: "G+" },
  { id: 6, title: "Tapestry", artist: "Carole King", price: "$18", condition: "VG+" },
];

const DiscoverScreen = () => {
  return (
    <div className="px-4 pt-4 pb-2">
      <h1 className="mb-1 font-display text-xl font-bold text-foreground">Discover</h1>
      <p className="mb-4 font-body text-xs text-muted-foreground">Find your next favourite record</p>

      {/* Categories */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {["All", "Rock", "Jazz", "Soul", "Electronic", "Hip Hop"].map((cat, i) => (
          <button
            key={cat}
            className={`shrink-0 rounded-full px-3 py-1.5 font-body text-[11px] font-medium transition-colors ${
              i === 0
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-primary/10 text-primary hover:bg-primary/20"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {featured.map((item) => (
          <div key={item.id} className="group rounded-xl bg-card p-2.5 vinyl-shadow transition-transform hover:scale-[1.02]">
            <div className="mb-2 flex aspect-square items-center justify-center rounded-lg bg-primary/10">
              <Disc3 size={36} className="text-primary transition-transform group-hover:rotate-45" />
            </div>
            <h3 className="font-display text-xs font-semibold leading-tight text-foreground">{item.title}</h3>
            <p className="mt-0.5 font-body text-[10px] text-muted-foreground">{item.artist}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-body text-sm font-bold text-primary">{item.price}</span>
              <span className="rounded bg-secondary px-1.5 py-0.5 font-body text-[9px] font-semibold text-secondary-foreground">
                {item.condition}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DiscoverScreen;
