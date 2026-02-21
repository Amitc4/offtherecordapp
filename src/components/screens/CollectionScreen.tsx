import { useState } from "react";
import { Disc3, Plus, Camera, LayoutGrid, List, RefreshCw, CheckSquare, X, Tag, Star } from "lucide-react";
import { useUserRecords } from "@/hooks/useDiscogs";
import { useDiscogsProfile, useDiscogsSync } from "@/hooks/useDiscogs";
import AddRecordDialog from "@/components/AddRecordDialog";
import RecordDetailSheet from "@/components/RecordDetailSheet";
import ScanRecordDialog from "@/components/ScanRecordDialog";
import GradeVinylDialog from "@/components/GradeVinylDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";

const CollectionScreen = () => {
  const [view, setView] = useState<"grid" | "list">("list");
  const [addOpen, setAddOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [gradeOpen, setGradeOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  const [marking, setMarking] = useState(false);
  const [detailRecord, setDetailRecord] = useState<any>(null);
  const { data: records = [], isLoading } = useUserRecords();
  const { data: profile } = useDiscogsProfile();
  const { syncCollection } = useDiscogsSync();
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
    setMenuOpen(false);
  };

  const handleMark = async (status: string) => {
    if (selected.size === 0) return;
    setMarking(true);
    const ids = Array.from(selected);
    const { error } = await supabase
      .from("user_records")
      .update({ status } as any)
      .in("id", ids);
    if (error) {
      toast.error("Failed to update records");
    } else {
      toast.success(`${ids.length} record${ids.length > 1 ? "s" : ""} marked as ${status === "for_sale" ? "For Sale / Trade" : "Personal Collection"}`);
      queryClient.invalidateQueries({ queryKey: ["user_records"] });
    }
    setMarking(false);
    setMenuOpen(false);
    exitSelectMode();
  };

  return (
    <div className="px-4 pt-4 pb-2">

      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-foreground">My Collection</h1>
        <div className="flex items-center gap-2">
          {!selectMode ? (
            <>
              <button
                onClick={() => setView(view === "grid" ? "list" : "grid")}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary active:scale-95"
              >
                {view === "grid" ? <List size={18} /> : <LayoutGrid size={18} />}
              </button>
              {records.length > 0 && (
                <button
                  onClick={() => setSelectMode(true)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary active:scale-95"
                >
                  <CheckSquare size={18} />
                </button>
              )}
              {profile?.discogs_connected && (
                <button
                  onClick={() => syncCollection.mutate()}
                  disabled={syncCollection.isPending}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary active:scale-95"
                >
                  <RefreshCw size={18} className={syncCollection.isPending ? "animate-spin" : ""} />
                </button>
              )}
              <button
                onClick={() => setScanOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary active:scale-95"
              >
                <Camera size={18} />
              </button>
              <button
                onClick={() => setGradeOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary active:scale-95"
                title="Grade Vinyl Condition"
              >
                <Star size={18} />
              </button>
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

      {selectMode ? (
        <p className="mb-4 font-body text-xs text-primary font-medium">
          {selected.size} selected · tap records to select
        </p>
      ) : (
        <p className="mb-4 font-body text-xs text-muted-foreground">{records.length} records</p>
      )}

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
          {records.map((record) => {
            const isSelected = selected.has(record.id);
            const recordStatus = (record as any).status as string | undefined;
            const recordPrice = (record as any).price as number | null | undefined;
            return (
              <div
                key={record.id}
                onClick={() => selectMode ? toggleSelect(record.id) : setDetailRecord(record)}
                className={`flex items-center gap-4 rounded-xl p-4 vinyl-shadow transition-all cursor-pointer ${isSelected ? "bg-primary/10 ring-2 ring-primary/40" : "bg-card"}`}
              >
                {selectMode && (
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                    isSelected ? "border-primary bg-primary" : "border-muted-foreground/30 bg-card"
                  }`}>
                    {isSelected && <CheckSquare size={14} className="text-primary-foreground" />}
                  </div>
                )}
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
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {recordStatus === "for_sale" && recordPrice != null && (
                    <span className="font-body text-sm font-bold text-primary">₪{recordPrice}</span>
                  )}
                  <div className="flex items-center gap-1.5">
                    {recordStatus === "for_sale" && (
                      <span className="rounded-md bg-primary/15 px-1.5 py-0.5 font-body text-[9px] font-semibold text-primary">
                        For Sale
                      </span>
                    )}
                    {record.condition && (
                      <span className="rounded-md bg-secondary px-2 py-1 font-body text-[10px] font-semibold text-secondary-foreground">
                        {record.condition}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {records.map((record) => {
            const isSelected = selected.has(record.id);
            const recordStatus = (record as any).status as string | undefined;
            const recordPrice = (record as any).price as number | null | undefined;
            return (
              <div
                key={record.id}
                onClick={() => selectMode ? toggleSelect(record.id) : setDetailRecord(record)}
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
                  {record.cover_image ? (
                    <img src={record.cover_image} alt={record.title} className="h-full w-full object-cover" />
                  ) : (
                    <Disc3 size={36} className="text-primary transition-transform group-hover:rotate-45" />
                  )}
                </div>
                <h3 className="font-display text-xs font-semibold leading-tight text-foreground truncate">{record.title}</h3>
                <p className="mt-0.5 font-body text-[10px] text-muted-foreground truncate">{record.artist}</p>
                <div className="mt-2 flex items-center justify-between">
                  {recordStatus === "for_sale" && recordPrice != null ? (
                    <span className="font-body text-xs font-bold text-primary">₪{recordPrice}</span>
                  ) : (
                    <span className="font-body text-xs text-muted-foreground">{record.year || "—"}</span>
                  )}
                  <div className="flex items-center gap-1">
                    {recordStatus === "for_sale" && (
                      <span className="rounded bg-primary/15 px-1 py-0.5 font-body text-[8px] font-semibold text-primary">
                        Sale
                      </span>
                    )}
                    {record.format && (
                      <span className="rounded bg-secondary px-1.5 py-0.5 font-body text-[9px] font-semibold text-secondary-foreground">
                        {record.format}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating "Mark As" button when in select mode */}
      <AnimatePresence>
        {selectMode && selected.size > 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2"
          >
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                disabled={marking}
                className="flex items-center gap-2 rounded-full bg-primary px-5 py-3 font-body text-sm font-semibold text-primary-foreground shadow-lg active:scale-95"
              >
                <Tag size={16} />
                Mark As ({selected.size})
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ y: 8, opacity: 0, scale: 0.95 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 8, opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 w-52 rounded-xl border border-border bg-card p-1.5 shadow-xl"
                  >
                    <button
                      onClick={() => handleMark("for_sale")}
                      disabled={marking}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-3 font-body text-sm font-medium text-foreground transition-colors hover:bg-primary/10 active:bg-primary/20"
                    >
                      <Tag size={15} className="text-primary" />
                      For Sale / Trade
                    </button>
                    <button
                      onClick={() => handleMark("personal")}
                      disabled={marking}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-3 font-body text-sm font-medium text-foreground transition-colors hover:bg-primary/10 active:bg-primary/20"
                    >
                      <Disc3 size={15} className="text-primary" />
                      Personal Collection
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AddRecordDialog open={addOpen} onOpenChange={setAddOpen} target="collection" />
      <RecordDetailSheet
        record={detailRecord}
        open={!!detailRecord}
        onOpenChange={(open) => !open && setDetailRecord(null)}
      />
      <ScanRecordDialog open={scanOpen} onOpenChange={setScanOpen} />
      <GradeVinylDialog open={gradeOpen} onOpenChange={setGradeOpen} />
    </div>
  );
};

export default CollectionScreen;
