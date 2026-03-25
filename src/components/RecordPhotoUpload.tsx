import { useState, useRef } from "react";
import { Camera, X, ImagePlus, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface RecordPhotoUploadProps {
  recordId: string;
  existingPhotos?: { id: string; photo_url: string }[];
  onPhotosChange: (photos: { id: string; photo_url: string }[]) => void;
  minPhotos?: number;
  maxPhotos?: number;
}

const RecordPhotoUpload = ({ recordId, existingPhotos = [], onPhotosChange, minPhotos = 2, maxPhotos = 4 }: RecordPhotoUploadProps) => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;

    const remaining = maxPhotos - existingPhotos.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${maxPhotos} photos allowed`);
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remaining);
    setUploading(true);
    const newPhotos: { id: string; photo_url: string }[] = [];

    for (const file of filesToUpload) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 5MB)`);
        continue;
      }

      const ext = file.name.split(".").pop();
      const path = `${user.id}/${recordId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage.from("record-photos").upload(path, file);
      if (uploadError) {
        toast.error(`Failed to upload ${file.name}`);
        continue;
      }

      const { data: { publicUrl } } = supabase.storage.from("record-photos").getPublicUrl(path);

      const { data, error } = await supabase
        .from("record_photos")
        .insert({ record_id: recordId, photo_url: publicUrl } as any)
        .select("id, photo_url")
        .single();

      if (!error && data) {
        newPhotos.push(data as any);
      }
    }

    if (newPhotos.length > 0) {
      const updated = [...existingPhotos, ...newPhotos];
      onPhotosChange(updated);
      toast.success(`${newPhotos.length} photo${newPhotos.length > 1 ? "s" : ""} uploaded`);
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemove = async (photoId: string) => {
    const { error } = await supabase.from("record_photos").delete().eq("id", photoId);
    if (error) {
      toast.error("Failed to remove photo");
      return;
    }
    const updated = existingPhotos.filter((p) => p.id !== photoId);
    onPhotosChange(updated);
  };

  const atMax = existingPhotos.length >= maxPhotos;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="font-body text-xs font-medium text-muted-foreground">
          Record & Cover Photos
        </p>
        <span className="font-body text-[10px] text-muted-foreground">
          {existingPhotos.length}/{maxPhotos}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {existingPhotos.map((photo) => (
          <div key={photo.id} className="relative h-20 w-20 overflow-hidden rounded-lg">
            <img src={photo.photo_url} alt="Record photo" className="h-full w-full object-cover" />
            <button
              onClick={() => handleRemove(photo.id)}
              className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
            >
              <X size={10} />
            </button>
          </div>
        ))}

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-primary/30 text-primary transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50"
        >
          {uploading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          ) : (
            <>
              <ImagePlus size={18} />
              <span className="font-body text-[9px]">Add</span>
            </>
          )}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
};

export default RecordPhotoUpload;
