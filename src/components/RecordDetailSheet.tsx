/**
 * @file RecordDetailSheet.tsx — Bottom sheet for managing a record in the user's collection.
 *
 * Opened from CollectionScreen when a record is tapped.
 *
 * **Features:**
 * - Cover art + metadata display (title, artist, year, format, condition).
 * - **Photo upload** – Add up to 4 photos of the record/cover via `RecordPhotoUpload`.
 * - **AI Grading** – Opens `GradeVinylDialog` to photograph and grade the vinyl's condition.
 * - **Status dropdown** – Switch between "For Sale / Trade", "Personal Collection", or "Sold".
 * - **Price input** – Shown only when status is "for_sale". Saves on blur or Enter.
 * - **Remove** – Delete the record from the collection with confirmation dialog.
 */
import { useRef, useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Disc3, Camera, Calendar, Tag, Package, Star, Trash2, Archive } from "lucide-react";
import GradeVinylDialog from "@/components/GradeVinylDialog";
import RecordPhotoUpload from "@/components/RecordPhotoUpload";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface RecordDetailSheetProps {
  record: {
    id: string;
    title: string;
    artist: string;
    year: number | null;
    cover_image: string | null;
    condition: string | null;
    format: string | null;
    notes: string | null;
    status?: string;
    price?: number | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_OPTIONS = [
  { value: "for_sale", label: "For Sale / Trade", icon: Tag, description: "Visible to other users" },
  { value: "personal", label: "Personal Collection", icon: Package, description: "Private to you" },
  { value: "sold", label: "Sold", icon: Archive, description: "Archived as sold" },
];

const RecordDetailSheet = ({ record, open, onOpenChange }: RecordDetailSheetProps) => {
  const queryClient = useQueryClient();
  const [updating, setUpdating] = useState(false);
  const [localStatus, setLocalStatus] = useState("personal");
  const [price, setPrice] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);
  const [gradeOpen, setGradeOpen] = useState(false);
  const [photos, setPhotos] = useState<{ id: string; photo_url: string }[]>([]);

  // Fetch existing photos when record opens
  useEffect(() => {
    if (!record?.id || !open) return;
    const fetchPhotos = async () => {
      const { data } = await supabase
        .from("record_photos")
        .select("id, photo_url")
        .eq("record_id", record.id)
        .order("created_at", { ascending: true });
      setPhotos(data || []);
    };
    fetchPhotos();
  }, [record?.id, open]);

  const recordStatus = record?.status;
  const recordPrice = record?.price;

  useEffect(() => {
    if (record) {
      setLocalStatus(recordStatus || "personal");
      setPrice(recordPrice != null ? String(recordPrice) : "");
    }
  }, [record?.id, recordStatus, recordPrice]);

  if (!record) return null;

  const handleStatusChange = async (newStatus: string) => {
    const oldStatus = localStatus;
    setLocalStatus(newStatus);
    setUpdating(true);
    const { error } = await supabase
      .from("user_records")
      .update({ status: newStatus } as any)
      .eq("id", record.id);
    if (error) {
      setLocalStatus(oldStatus);
      toast.error("Failed to update status");
    } else {
      const label = STATUS_OPTIONS.find(o => o.value === newStatus)?.label || newStatus;
      toast.success(`Marked as ${label}`, { position: "top-center" });
      queryClient.invalidateQueries({ queryKey: ["user_records"] });
    }
    setUpdating(false);
  };

  const handlePriceSave = async () => {
    const numPrice = price.trim() ? parseFloat(price) : null;
    if (price.trim() && (isNaN(numPrice!) || numPrice! < 0)) {
      toast.error("Please enter a valid price");
      return;
    }
    setSavingPrice(true);
    const { error } = await supabase
      .from("user_records")
      .update({ price: numPrice } as any)
      .eq("id", record.id);
    if (error) {
      toast.error("Failed to save price");
    } else {
      toast.success(numPrice != null ? `Price set to ₪${numPrice}` : "Price removed", { position: "top-center" });
      queryClient.invalidateQueries({ queryKey: ["user_records"] });
    }
    setSavingPrice(false);
  };

  const currentOption = STATUS_OPTIONS.find(o => o.value === localStatus) || STATUS_OPTIONS[1];
  const StatusIcon = currentOption.icon;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl border-t border-border bg-card px-0 pb-8">
        <SheetHeader className="px-5 pb-2">
          <SheetTitle className="font-display text-lg text-foreground">Record Details</SheetTitle>
        </SheetHeader>

        <div className="px-5 space-y-5">
          {/* Cover + title area */}
          <div className="flex gap-4">
            <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-primary/10">
              {record.cover_image ? (
                <img src={record.cover_image} alt={record.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Disc3 size={48} className="text-primary" fill="hsl(var(--primary) / 0.2)" />
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col justify-center min-w-0">
              <h2 className="font-display text-base font-bold text-foreground leading-tight">{record.title}</h2>
              <p className="mt-1 font-body text-sm text-muted-foreground">{record.artist}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {record.year && (
                  <span className="flex items-center gap-1 font-body text-xs text-muted-foreground">
                    <Calendar size={12} /> {record.year}
                  </span>
                )}
                {record.format && (
                  <span className="rounded bg-secondary px-1.5 py-0.5 font-body text-[10px] font-semibold text-secondary-foreground">
                    {record.format}
                  </span>
                )}
                {record.condition && (
                  <span className="rounded-md bg-primary/15 px-1.5 py-0.5 font-body text-[10px] font-semibold text-primary">
                    {record.condition}
                  </span>
                )}
              </div>
            </div>
          </div>

          {record.notes && (
            <div>
              <p className="mb-1 font-body text-xs font-medium text-muted-foreground">Notes</p>
              <p className="font-body text-sm text-foreground">{record.notes}</p>
            </div>
          )}
          {/* Record & cover photos */}
          <RecordPhotoUpload
            recordId={record.id}
            existingPhotos={photos}
            onPhotosChange={setPhotos}
            minPhotos={0}
          />

          {/* AI Grade button */}
          <button
            onClick={() => setGradeOpen(true)}
            className="flex w-full items-center gap-3 rounded-xl bg-primary/10 p-4 transition-colors active:bg-primary/20"
          >
            <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Camera size={20} />
              <Star size={10} className="absolute -top-0.5 -right-0.5 text-primary fill-primary" />
            </div>
            <div className="text-left">
              <p className="font-body text-sm font-semibold text-foreground">Grade this record</p>
              <p className="font-body text-xs text-muted-foreground">Take photos to get an AI condition grade</p>
            </div>
          </button>

          <GradeVinylDialog open={gradeOpen} onOpenChange={setGradeOpen} />

          {/* Status dropdown */}
          <div className="rounded-xl bg-background p-4">
            <div className="flex items-center gap-3 mb-2">
              <StatusIcon size={18} className="text-primary" />
              <div>
                <p className="font-body text-sm font-medium text-foreground">Record Status</p>
                <p className="font-body text-[11px] text-muted-foreground">{currentOption.description}</p>
              </div>
            </div>
            <Select value={localStatus} onValueChange={handleStatusChange} disabled={updating}>
              <SelectTrigger className="h-11 font-body text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="flex items-center gap-2">
                      <opt.icon size={14} />
                      {opt.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Price input — shown when for sale */}
          <AnimatePresence>
            {localStatus === "for_sale" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="rounded-xl bg-background p-4">
                  <p className="mb-2 font-body text-xs font-medium text-muted-foreground">Listing Price</p>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm font-semibold text-muted-foreground">₪</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        onBlur={handlePriceSave}
                        onKeyDown={(e) => e.key === "Enter" && handlePriceSave()}
                        className="h-11 pl-8 font-body text-sm"
                      />
                    </div>
                    <button
                      onClick={handlePriceSave}
                      disabled={savingPrice}
                      className="h-11 shrink-0 rounded-lg bg-primary px-4 font-body text-sm font-semibold text-primary-foreground active:scale-95 disabled:opacity-50"
                    >
                      {savingPrice ? "..." : "Save"}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Remove from collection */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-xl bg-destructive/10 p-4 transition-colors active:bg-destructive/20">
                <Trash2 size={18} className="text-destructive" />
                <p className="font-body text-sm font-medium text-destructive">Remove from Collection</p>
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove Record</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to remove "{record.title}" from your collection? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={async () => {
                    const { error } = await supabase
                      .from("user_records")
                      .delete()
                      .eq("id", record.id);
                    if (error) {
                      toast.error("Failed to remove record");
                    } else {
                      toast.success("Record removed from collection");
                      queryClient.invalidateQueries({ queryKey: ["user_records"] });
                      onOpenChange(false);
                    }
                  }}
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default RecordDetailSheet;
