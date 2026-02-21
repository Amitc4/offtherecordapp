import { useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Disc3, Camera, Calendar, Music, Tag, Package } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RecordDetailSheet = ({ record, open, onOpenChange }: RecordDetailSheetProps) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [updating, setUpdating] = useState(false);

  if (!record) return null;

  const isForSale = (record as any).status === "for_sale";

  const handleStatusToggle = async (checked: boolean) => {
    setUpdating(true);
    const newStatus = checked ? "for_sale" : "personal";
    const { error } = await supabase
      .from("user_records")
      .update({ status: newStatus } as any)
      .eq("id", record.id);
    if (error) {
      toast.error("Failed to update status");
    } else {
      toast.success(checked ? "Marked as For Sale / Trade" : "Marked as Personal Collection");
      queryClient.invalidateQueries({ queryKey: ["user_records"] });
    }
    setUpdating(false);
  };

  const handleCameraPress = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      stream.getTracks().forEach((t) => t.stop());
      fileInputRef.current?.click();
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        toast.error("Camera access denied. Please enable it in your device settings.");
      } else if (err.name === "NotFoundError") {
        toast.error("No camera found on this device.");
      } else {
        toast.error("Could not access camera. Check your browser/device settings.");
      }
    }
  };

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      toast.info("Photo captured! AI grading coming soon.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl border-t border-border bg-card px-0 pb-8">
        <SheetHeader className="px-5 pb-2">
          <SheetTitle className="font-display text-lg text-foreground">Record Details</SheetTitle>
        </SheetHeader>

        {/* Hidden camera input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleCapture}
        />

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

          {/* Notes */}
          {record.notes && (
            <div>
              <p className="mb-1 font-body text-xs font-medium text-muted-foreground">Notes</p>
              <p className="font-body text-sm text-foreground">{record.notes}</p>
            </div>
          )}

          {/* Camera button for grading */}
          <button
            onClick={handleCameraPress}
            className="flex w-full items-center gap-3 rounded-xl bg-primary/10 p-4 transition-colors active:bg-primary/20"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Camera size={20} />
            </div>
            <div className="text-left">
              <p className="font-body text-sm font-semibold text-foreground">Grade this record</p>
              <p className="font-body text-xs text-muted-foreground">Take a photo to get an AI condition grade</p>
            </div>
          </button>

          {/* Status toggle */}
          <div className="flex items-center justify-between rounded-xl bg-background p-4">
            <div className="flex items-center gap-3">
              {isForSale ? (
                <Tag size={18} className="text-primary" />
              ) : (
                <Package size={18} className="text-muted-foreground" />
              )}
              <div>
                <p className="font-body text-sm font-medium text-foreground">
                  {isForSale ? "For Sale / Trade" : "Personal Collection"}
                </p>
                <p className="font-body text-[11px] text-muted-foreground">
                  {isForSale ? "Visible to other users" : "Private to you"}
                </p>
              </div>
            </div>
            <Switch
              checked={isForSale}
              onCheckedChange={handleStatusToggle}
              disabled={updating}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default RecordDetailSheet;
