import { useState } from "react";
import { Disc3, Plus, Camera, LayoutGrid, List } from "lucide-react";

const records = [
  { id: 1, title: "Rumours", artist: "Fleetwood Mac", year: 1977, condition: "VG+" },
  { id: 2, title: "Kind of Blue", artist: "Miles Davis", year: 1959, condition: "NM" },
  { id: 3, title: "Abbey Road", artist: "The Beatles", year: 1969, condition: "G+" },
  { id: 4, title: "Blue Train", artist: "John Coltrane", year: 1958, condition: "VG" },
];

const CollectionScreen = () => {
  const [view, setView] = useState<"grid" | "list">("list");

  return (
    <div className="px-4 pt-4 pb-2">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-foreground">My Collection</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView(view === "grid" ? "list" : "grid")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary"
          >
            {view === "grid" ? <List size={18} /> : <LayoutGrid size={18} />}
          </button>
          <button className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Camera size={18} />
          </button>
          <button className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Plus size={18} />
          </button>
        </div>
      </div>
      <p className="mb-4 font-body text-xs text-muted-foreground">{records.length} records</p>

      {view === "list" ? (
        <div className="space-y-3">
          {records.map((record) => (
            <div key={record.id} className="flex items-center gap-4 rounded-xl bg-card p-4 vinyl-shadow">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/15">
                <Disc3 size={24} className="text-primary" fill="hsl(var(--primary) / 0.2)" />
              </div>
              <div className="flex-1">
                <h3 className="font-display text-sm font-semibold text-foreground">{record.title}</h3>
                <p className="font-body text-xs text-muted-foreground">{record.artist} · {record.year}</p>
              </div>
              <span className="rounded-md bg-secondary px-2 py-1 font-body text-[10px] font-semibold text-secondary-foreground">
                {record.condition}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {records.map((record) => (
            <div key={record.id} className="group rounded-xl bg-card p-2.5 vinyl-shadow transition-transform hover:scale-[1.02]">
              <div className="mb-2 flex aspect-square items-center justify-center rounded-lg bg-primary/10">
                <Disc3 size={36} className="text-primary transition-transform group-hover:rotate-45" />
              </div>
              <h3 className="font-display text-xs font-semibold leading-tight text-foreground">{record.title}</h3>
              <p className="mt-0.5 font-body text-[10px] text-muted-foreground">{record.artist}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-body text-xs text-muted-foreground">{record.year}</span>
                <span className="rounded bg-secondary px-1.5 py-0.5 font-body text-[9px] font-semibold text-secondary-foreground">
                  {record.condition}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CollectionScreen;
