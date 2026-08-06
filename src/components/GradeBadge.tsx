/**
 * @file GradeBadge.tsx — Circular condition-grade badge shown on the top-right
 * corner of a record cover, matching the position/size/shadow of SealedDiamond
 * but containing a short text code (NM, VG+, VG, G+, G, F, P) instead of an icon.
 *
 * Rendered only when the record has a stored grade. Deeper orange = worse grade.
 */

/** Grades ordered best → worst, with the orange tint used for each tier. */
const GRADES: { code: string; label: string; tint: string }[] = [
  { code: "NM", label: "Near Mint", tint: "hsl(var(--grade-light))" },
  { code: "VG+", label: "Very Good Plus", tint: "hsl(var(--grade-light))" },
  { code: "VG", label: "Very Good", tint: "hsl(var(--grade-mid))" },
  { code: "G+", label: "Good Plus", tint: "hsl(var(--grade-mid))" },
  { code: "G", label: "Good", tint: "hsl(var(--grade-deep))" },
  { code: "F", label: "Fair", tint: "hsl(var(--grade-deep))" },
  { code: "P", label: "Poor", tint: "hsl(var(--grade-deep))" },
];

/**
 * Resolves a stored condition string onto a known grade, or `null` when the
 * record is ungraded / uses a non-grade condition value.
 */
export const resolveGrade = (condition?: string | null) => {
  if (!condition) return null;
  const raw = condition.trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  // Exact code first (longest codes first so "VG+" wins over "VG").
  const exact = GRADES.find((g) => g.code === upper);
  if (exact) return exact;
  const byLabel = GRADES.find((g) => g.label.toLowerCase() === raw.toLowerCase());
  if (byLabel) return byLabel;
  const loose = [...GRADES]
    .sort((a, b) => b.code.length - a.code.length)
    .find(
      (g) =>
        upper.includes(g.code) || raw.toLowerCase().includes(g.label.toLowerCase()),
    );
  return loose || null;
};

/** True when the record carries a recognised condition grade. */
export const hasGrade = (condition?: string | null) => resolveGrade(condition) !== null;

interface GradeBadgeProps {
  condition?: string | null;
  /** Compact variant used on 48px list thumbnails. */
  small?: boolean;
  /** Shift left so it doesn't collide with another corner badge. */
  offset?: boolean;
}

const GradeBadge = ({ condition, small = false, offset = false }: GradeBadgeProps) => {
  const grade = resolveGrade(condition);
  if (!grade) return null;

  return (
    <div
      className={`absolute z-10 flex items-center justify-center rounded-full shadow-md ring-2 ring-card ${
        small
          ? `-top-1 ${offset ? "right-4" : "-right-1"} h-5 w-5`
          : `top-1.5 ${offset ? "right-9" : "right-1.5"} h-6 w-6`
      }`}
      style={{ backgroundColor: grade.tint }}
      title={`Condition grade: ${grade.label} (${grade.code})`}
      aria-label={`Condition grade: ${grade.label}`}
    >
      <span
        className={`font-body font-bold leading-none ${small ? "text-[7px]" : "text-[9px]"}`}
        style={{ color: "hsl(var(--grade-badge-foreground))" }}
      >
        {grade.code}
      </span>
    </div>
  );
};

export default GradeBadge;
