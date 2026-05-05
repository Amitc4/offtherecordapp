/**
 * @file QuarterTutorial.tsx — Animated visual tutorial that shows the user
 * exactly which quarter of the vinyl to photograph and how to frame the shot.
 *
 * Renders an animated SVG of a vinyl record with:
 * - The selected quarter wedge highlighted.
 * - The center label pulsing (must be visible in the photo).
 * - A camera/phone icon panning into the highlighted quarter.
 *
 * Used inside `GradeVinylDialog` before opening the camera for a slot.
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Smartphone } from "lucide-react";
import { motion } from "framer-motion";

interface QuarterTutorialProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 0-3 = Side A Q1-Q4, 4-7 = Side B Q1-Q4 */
  slotIndex: number;
  onConfirm: () => void;
}

const QUARTER_NAMES = [
  "Side A · Quarter 1 (top-right)",
  "Side A · Quarter 2 (bottom-right)",
  "Side A · Quarter 3 (bottom-left)",
  "Side A · Quarter 4 (top-left)",
  "Side B · Quarter 1 (top-right)",
  "Side B · Quarter 2 (bottom-right)",
  "Side B · Quarter 3 (bottom-left)",
  "Side B · Quarter 4 (top-left)",
];

// Each quarter wedge as an SVG path. Center is (100, 100), radius 90.
// Q1: top-right (-90° to 0°), Q2: bottom-right (0° to 90°),
// Q3: bottom-left (90° to 180°), Q4: top-left (180° to 270°)
const wedgePath = (qIndex0to3: number) => {
  const cx = 100, cy = 100, r = 90;
  // Start angle for q0 (top-right) = -90°. Each quarter is +90°.
  const startDeg = -90 + qIndex0to3 * 90;
  const endDeg = startDeg + 90;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
};

// Where the camera icon should sit at the end of its travel for each quarter
const cameraTarget = (qIndex0to3: number) => {
  switch (qIndex0to3) {
    case 0: return { x: 140, y: 60 };  // top-right
    case 1: return { x: 140, y: 140 }; // bottom-right
    case 2: return { x: 60, y: 140 };  // bottom-left
    case 3: return { x: 60, y: 60 };   // top-left
    default: return { x: 100, y: 100 };
  }
};

const QuarterTutorial = ({ open, onOpenChange, slotIndex, onConfirm }: QuarterTutorialProps) => {
  const sideIndex = slotIndex < 4 ? 0 : 1; // 0 = Side A, 1 = Side B
  const quarterIndex = slotIndex % 4; // 0..3
  const sideLabel = sideIndex === 0 ? "Side A" : "Side B";
  const target = cameraTarget(quarterIndex);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-base">
            {QUARTER_NAMES[slotIndex]}
          </DialogTitle>
        </DialogHeader>

        {/* Animated tutorial */}
        <div className="relative mx-auto h-56 w-56">
          <svg viewBox="0 0 200 200" className="h-full w-full">
            {/* Vinyl record body */}
            <circle cx="100" cy="100" r="90" fill="hsl(var(--foreground))" />
            {/* Grooves */}
            {[80, 70, 60, 50, 40].map((r) => (
              <circle
                key={r}
                cx="100"
                cy="100"
                r={r}
                fill="none"
                stroke="hsl(var(--background) / 0.15)"
                strokeWidth="0.5"
              />
            ))}

            {/* Highlighted quarter wedge */}
            <motion.path
              d={wedgePath(quarterIndex)}
              fill="hsl(var(--primary))"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.55, 0.35, 0.55] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* Quarter divider lines */}
            <line x1="100" y1="10" x2="100" y2="190" stroke="hsl(var(--background) / 0.5)" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="10" y1="100" x2="190" y2="100" stroke="hsl(var(--background) / 0.5)" strokeWidth="1" strokeDasharray="3 3" />

            {/* Center label — must be visible */}
            <motion.circle
              cx="100"
              cy="100"
              r="22"
              fill={sideIndex === 0 ? "hsl(var(--accent, var(--primary)))" : "hsl(15 80% 55%)"}
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              style={{ transformOrigin: "100px 100px" }}
            />
            <text
              x="100"
              y="104"
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              fill="hsl(var(--background))"
            >
              {sideLabel}
            </text>

            {/* Spindle hole */}
            <circle cx="100" cy="100" r="3" fill="hsl(var(--background))" />

            {/* Animated camera icon panning into the quarter */}
            <motion.g
              initial={{ x: target.x - 100, y: target.y - 100, opacity: 0, scale: 0.6 }}
              animate={{
                x: [0, target.x - 100],
                y: [0, target.y - 100],
                opacity: [0, 1, 1, 0],
                scale: [0.6, 1, 1, 0.6],
              }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", times: [0, 0.4, 0.85, 1] }}
              style={{ transformOrigin: "100px 100px" }}
            >
              <rect x="92" y="92" width="16" height="16" rx="3" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="1.5" />
              <circle cx="100" cy="100" r="4" fill="hsl(var(--primary))" />
            </motion.g>
          </svg>

          {/* Phone icon corner marker */}
          <motion.div
            className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <Smartphone size={16} />
          </motion.div>
        </div>

        {/* Tips */}
        <div className="space-y-2 rounded-xl bg-muted p-3">
          <Tip num={1}>Frame the highlighted quarter — fill the photo with it.</Tip>
          <Tip num={2}>Always include the <strong>center label</strong> in the shot.</Tip>
          <Tip num={3}>Use bright, even light; avoid glare and shadows.</Tip>
          <Tip num={4}>Hold steady and focus — quality matters for accurate grading.</Tip>
        </div>

        <Button onClick={onConfirm} className="gap-2 w-full">
          <Camera size={16} />
          Open Camera
        </Button>
      </DialogContent>
    </Dialog>
  );
};

const Tip = ({ num, children }: { num: number; children: React.ReactNode }) => (
  <div className="flex items-start gap-2">
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-display text-[10px] font-bold">
      {num}
    </span>
    <p className="font-body text-xs text-foreground">{children}</p>
  </div>
);

export default QuarterTutorial;
