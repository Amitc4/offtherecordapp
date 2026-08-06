/**
 * @file CameraCapture.tsx — In-app camera view with a circular guide overlay
 * and device-level gating.
 *
 * Uses `navigator.mediaDevices.getUserMedia` to open the rear camera and shows
 * a circular outline the user should align with the vinyl (full mode) or the
 * center label (macro mode). Captures a frame to a canvas and returns it as a
 * `File` via `onCapture`.
 *
 * **Level gating:** the phone must be flat and parallel to the record, or the
 * disc is photographed as an ellipse. The guide border is red while the device
 * is tilted and green once it is level (see `useDeviceLevel`,
 * `LEVEL_TOLERANCE_DEG`), and the shutter is disabled while red.
 *
 * If motion permission is denied or the device has no orientation sensors, the
 * shutter is enabled anyway (users must never be locked out) and `onCapture`
 * receives `levelVerified: false` so those photos can be told apart later.
 */
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, X, RotateCcw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useDeviceLevel } from "@/hooks/useDeviceLevel";

export type CaptureMode = "full" | "macro";

export interface CaptureMeta {
  /** False when levelness could not be verified (no sensors / permission denied). */
  levelVerified: boolean;
}

interface CameraCaptureProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: CaptureMode;
  title: string;
  hint: string;
  onCapture: (file: File, meta: CaptureMeta) => void;
}

const CameraCapture = ({ open, onOpenChange, mode, title, hint, onCapture }: CameraCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const [ready, setReady] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const level = useDeviceLevel(open);
  const { supported, isLevel, permission, levelVerified, requestPermission } = level;

  /** Sensors usable → gate the shutter. Otherwise never block the user. */
  const gated = levelVerified;
  const guideOk = gated ? isLevel : true;
  const shutterDisabled = !ready || capturing || (gated && !isLevel);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setReady(false);
    setPreviewUrl(null);
    blobRef.current = null;

    (async () => {
      // Ask for motion permission first — iOS 13+ requires a user gesture, and
      // opening the camera is that gesture.
      await requestPermission();

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch (err) {
        console.error("Camera error:", err);
        toast.error("Couldn't access the camera. Check browser permissions.");
        onOpenChange(false);
      }
    })();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const shoot = async () => {
    const video = videoRef.current;
    if (!video) return;
    setCapturing(true);
    try {
      const w = video.videoWidth;
      const h = video.videoHeight;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas ctx");
      ctx.drawImage(video, 0, 0, w, h);
      const blob: Blob = await new Promise((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej(new Error("no blob"))), "image/jpeg", 0.92)
      );
      blobRef.current = blob;
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (err) {
      console.error(err);
      toast.error("Capture failed. Try again.");
    } finally {
      setCapturing(false);
    }
  };

  const confirm = () => {
    const blob = blobRef.current;
    if (!blob) return;
    const file = new File([blob], `vinyl-${mode}-${Date.now()}.jpg`, { type: "image/jpeg" });
    onCapture(file, { levelVerified });
    blobRef.current = null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    onOpenChange(false);
  };

  const retake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    blobRef.current = null;
  };

  // Circle sizing as % of shortest side
  const circlePct = mode === "full" ? 92 : 45;
  const guideColor = guideOk ? "#22c55e" : "#ef4444";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-black border-none">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <div className="relative w-full aspect-square bg-black">
          {previewUrl ? (
            <img src={previewUrl} alt="Preview" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}

          {/* Circular guide overlay — red until the phone is level, then green. */}
          {!previewUrl && (
            <svg
              className="absolute inset-0 h-full w-full pointer-events-none"
              viewBox="0 0 100 100"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Dim outside area with an even-odd mask */}
              <defs>
                <mask id="hole">
                  <rect width="100" height="100" fill="white" />
                  <circle cx="50" cy="50" r={circlePct / 2} fill="black" />
                </mask>
              </defs>
              <rect width="100" height="100" fill="black" fillOpacity="0.35" mask="url(#hole)" />
              <circle
                cx="50"
                cy="50"
                r={circlePct / 2}
                fill="none"
                stroke={guideColor}
                strokeWidth="0.9"
                strokeDasharray="1.5 1.5"
                style={{ transition: "stroke 200ms linear" }}
              />
              {/* Center dot for macro mode */}
              {mode === "macro" && <circle cx="50" cy="50" r="0.8" fill={guideColor} />}
            </svg>
          )}

          {/* Header */}
          <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/80 to-transparent p-3 flex items-start justify-between">
            <div className="text-white">
              <p className="font-display text-sm font-semibold">{title}</p>
              <p className="font-body text-[11px] opacity-80 max-w-[260px]">{hint}</p>
              {!previewUrl && permission === "unknown" && (
                <p className="font-body text-[11px] opacity-80 max-w-[260px]">
                  Motion access is used to check the phone is flat above the record.
                </p>
              )}
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-full bg-black/50 p-1.5 text-white"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Level feedback + notices */}
          {!previewUrl && (
            <div className="absolute inset-x-0 bottom-24 flex flex-col items-center gap-2 px-4">
              {gated && !isLevel && (
                <p className="rounded-full bg-black/70 px-3 py-1.5 font-body text-xs font-medium text-white">
                  Hold the phone flat above the record.
                </p>
              )}
              {!gated && (
                <p className="flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 font-body text-[11px] text-white">
                  <AlertTriangle size={13} className="text-primary" />
                  Levelness couldn&apos;t be verified on this device.
                </p>
              )}
              {supported && (
                <p className="font-body text-[10px] text-white/60">
                  Tilt {Math.abs(level.beta).toFixed(0)}° / {Math.abs(level.gamma).toFixed(0)}°
                </p>
              )}
            </div>
          )}

          {/* Footer controls */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-4 flex items-center justify-center gap-4">
            {previewUrl ? (
              <>
                <Button variant="secondary" onClick={retake} className="gap-2">
                  <RotateCcw size={16} /> Retake
                </Button>
                <Button onClick={confirm} className="gap-2">
                  Use photo
                </Button>
              </>
            ) : (
              <button
                onClick={shoot}
                disabled={shutterDisabled}
                className="h-16 w-16 rounded-full bg-white ring-4 ring-white/40 disabled:opacity-40 flex items-center justify-center"
                style={{ boxShadow: `0 0 0 2px ${guideColor}` }}
                aria-label="Capture"
              >
                <Camera size={26} className="text-black" />
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CameraCapture;
