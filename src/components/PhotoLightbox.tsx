/**
 * @file PhotoLightbox.tsx — Full-screen viewer for record photos.
 *
 * Also exports `useSignedRecordPhotoUrls`, which converts the public URLs stored in
 * `record_photos.photo_url` into short-lived signed URLs (the `record-photos`
 * bucket is private, so raw public URLs do not load).
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";


const BUCKET = "record-photos";

const extractPath = (url: string): string | null => {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
};

/** Returns display-ready URLs (signed where possible) for the given photo URLs. */
export const useSignedRecordPhotoUrls = (urls: string[]): string[] => {
  const [signed, setSigned] = useState<string[]>(urls);
  const key = urls.join("|");

  useEffect(() => {
    if (urls.length === 0) {
      setSigned([]);
      return;
    }
    const paths = urls.map(extractPath);
    const validPaths = paths.filter((p): p is string => !!p);
    if (validPaths.length === 0) {
      setSigned(urls);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.storage.from(BUCKET).createSignedUrls(validPaths, 3600);
      if (cancelled) return;
      const map = new Map<string, string>();
      data?.forEach((d, i) => {
        if (d.signedUrl) map.set(validPaths[i], d.signedUrl);
      });
      setSigned(urls.map((u, i) => (paths[i] && map.get(paths[i]!)) || u));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return signed;
};

interface PhotoLightboxProps {
  urls: string[];
  index: number | null;
  onClose: () => void;
  onIndexChange?: (i: number) => void;
}

const PhotoLightbox = ({ urls, index, onClose, onIndexChange }: PhotoLightboxProps) => {
  if (index === null || !urls[index]) return null;

  const go = (delta: number) => {
    const next = (index + delta + urls.length) % urls.length;
    onIndexChange?.(next);
  };

  return createPortal(
    <div
      className="pointer-events-auto fixed inset-0 z-[200] flex items-center justify-center bg-foreground/95 p-4"
      style={{ touchAction: "none" }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onPointerUp={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        aria-label="Close photo"
        className="pointer-events-auto absolute right-3 top-3 z-[210] flex h-11 w-11 items-center justify-center rounded-full bg-background/25 text-background active:bg-background/40"
      >
        <X size={22} />
      </button>


      {urls.length > 1 && (
        <>
          <button
            aria-label="Previous photo"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            className="absolute left-2 flex h-10 w-10 items-center justify-center rounded-full bg-background/20 text-background"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            aria-label="Next photo"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            className="absolute right-2 flex h-10 w-10 items-center justify-center rounded-full bg-background/20 text-background"
          >
            <ChevronRight size={22} />
          </button>
        </>
      )}

      <img
        src={urls[index]}
        alt="Record photo full size"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-full rounded-lg object-contain"
      />

      {urls.length > 1 && (
        <p className="absolute bottom-6 font-body text-xs text-background/80">
          {index + 1} / {urls.length}
        </p>
      )}
    </div>,
    document.body
  );
};

export default PhotoLightbox;
