import { useState } from "react";
import { Disc3, Plus, Camera, LayoutGrid, List, RefreshCw } from "lucide-react";
import { useUserRecords } from "@/hooks/useDiscogs";
import { useDiscogsProfile, useDiscogsSync } from "@/hooks/useDiscogs";

const CollectionScreen = () => {
  const [view, setView] = useState<"grid" | "list">("list");
  const { data: records = [], isLoading } = useUserRecords();
  const { data: profile } = useDiscogsProfile();
  const { syncCollection } = useDiscogsSync();

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
          {profile?.discogs_connected && (
            <button
              onClick={() => syncCollection.mutate()}
              disabled={syncCollection.isPending}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary"
            >
              <RefreshCw size={18} className={syncCollection.isPending ? "animate-spin" : ""} />
            </button>
          )}
          <button className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Camera size={18} />
          </button>
          <button className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Plus size={18} />
          </button>
        </div>
      </div>
      <p className="mb-4 font-body text-xs text-muted-foreground">{records.length} records</p>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <Disc3 size={48} className="mb-4 text-muted-foreground/40" />
          <p className="font-body text-sm text-muted-foreground">No records yet</p>
          <p className="mt-1 font-body text-xs text-muted-foreground/60">
            {profile?.discogs_connected
              ? "Tap the sync button to import from Discogs"
              : "Connect your Discogs account in Profile to import"}
          </p>
        </div>
      ) : view === "list" ? (
        <div className="space-y-3">
          {records.map((record) => (
            <div key={record.id} className="flex items-center gap-4 rounded-xl bg-card p-4 vinyl-shadow">
              {record.cover_image ? (
                <img src={record.cover_image} alt={record.title} className="h-12 w-12 rounded-lg object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/15">
                  <Disc3 size={24} className="text-primary" fill="hsl(var(--primary) / 0.2)" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-sm font-semibold text-foreground truncate">{record.title}</h3>
                <p className="font-body text-xs text-muted-foreground truncate">{record.artist}{record.year ? ` · ${record.year}` : ""}</p>
              </div>
              {record.condition && (
                <span className="shrink-0 rounded-md bg-secondary px-2 py-1 font-body text-[10px] font-semibold text-secondary-foreground">
                  {record.condition}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {records.map((record) => (
            <div key={record.id} className="group rounded-xl bg-card p-2.5 vinyl-shadow transition-transform hover:scale-[1.02]">
              <div className="mb-2 flex aspect-square items-center justify-center rounded-lg bg-primary/10 overflow-hidden">
                {record.cover_image ? (
                  <img src={record.cover_image} alt={record.title} className="h-full w-full object-cover" />
                ) : (
                  <Disc3 size={36} className="text-primary transition-transform group-hover:rotate-45" />
                )}
              </div>
              <h3 className="font-display text-xs font-semibold leading-tight text-foreground truncate">{record.title}</h3>
              <p className="mt-0.5 font-body text-[10px] text-muted-foreground truncate">{record.artist}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-body text-xs text-muted-foreground">{record.year || "—"}</span>
                {record.format && (
                  <span className="rounded bg-secondary px-1.5 py-0.5 font-body text-[9px] font-semibold text-secondary-foreground">
                    {record.format}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CollectionScreen;
