/**
 * @file RecordCardInfo.tsx — Compact stacked info list rendered below a record's
 * cover image on the Collection, Discover and Wishlist cards.
 *
 * Lines, in order:
 * 1. Record name
 * 2. Artist name
 * 3. Year of release
 * 4. Classifications (format / genre / sealed, e.g. "Vinyl, LP, Album")
 * 5. Availability — only when `status` is provided (Collection tab):
 *    "For sale · ₪120" / "Open to trade" / "Personal collection" / "Sold"
 */
import { ShieldCheck, Sparkles } from "lucide-react";
import { displayName, textDirClass } from "@/lib/utils";

interface RecordCardInfoProps {
  title: string;
  artist: string;
  year?: number | null;
  format?: string | null;
  genre?: string | null;
  sealed?: boolean | null;
  condition?: string | null;
  /** "for_sale" | "personal" | "sold" — omit to hide the availability line. */
  status?: string | null;
  price?: number | null;
  /** Slightly larger type for list view. */
  size?: "sm" | "md";
}

/** Builds the classification list, e.g. "Vinyl, LP, Album, Limited Edition". */
export const buildClassifications = (
  format?: string | null,
  genre?: string | null,
  sealed?: boolean | null,
): string[] => {
  const parts: string[] = [];
  if (format) {
    format
      .split(/[,/]/)
      .map((p) => p.trim())
      .filter(Boolean)
      .forEach((p) => parts.push(p));
  }
  if (genre) parts.push(genre);
  if (sealed) parts.push("Limited / Sealed");
  const seen = new Set<string>();
  return parts.filter((p) => {
    const key = p.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const RecordCardInfo = ({
  title,
  artist,
  year,
  format,
  genre,
  sealed,
  condition,
  status,
  price,
  size = "sm",
}: RecordCardInfoProps) => {
  const classifications = buildClassifications(format, genre, sealed);
  const titleSize = size === "md" ? "text-base" : "text-sm";
  const lineSize = size === "md" ? "text-sm" : "text-xs";
  const metaSize = size === "md" ? "text-xs" : "text-[10px]";

  const availability =
    status === "for_sale"
      ? price != null
        ? `For sale · ₪${price}`
        : "For sale · Open to trade"
      : status === "sold"
        ? "Sold"
        : status === "personal"
          ? "Personal collection"
          : null;

  return (
    <div className="min-w-0">
      <h3
        className={`font-display ${titleSize} font-semibold leading-tight text-foreground truncate ${textDirClass(displayName(title))}`}
      >
        {displayName(title)}
      </h3>
      <p className={`font-display ${lineSize} text-muted-foreground truncate ${textDirClass(displayName(artist))}`}>
        {displayName(artist)}
      </p>
      <p className={`font-body ${metaSize} text-muted-foreground`}>{year || "—"}</p>
      {classifications.length ? (
        <div className="mt-0.5 flex flex-wrap gap-1">
          {classifications.map((c) => (
            <span
              key={c}
              className={`font-body ${metaSize} rounded-full bg-muted px-1.5 py-0.5 leading-tight text-muted-foreground max-w-full truncate`}
            >
              {c}
            </span>
          ))}
        </div>
      ) : (
        <p className={`font-body ${metaSize} text-muted-foreground`}>—</p>
      )}

      {(sealed || condition) && (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {sealed && (
            <span
              className={`inline-flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 font-body ${metaSize} font-bold leading-tight text-primary`}
              title="Factory sealed — highest possible grade"
            >
              <ShieldCheck size={size === "md" ? 13 : 11} /> Sealed
            </span>
          )}
          {condition && (
            <span
              className={`inline-flex items-center gap-1 rounded-full bg-secondary px-1.5 py-0.5 font-body ${metaSize} font-semibold leading-tight text-secondary-foreground`}
              title={`Grade: ${condition}`}
            >
              <Sparkles size={size === "md" ? 13 : 11} /> {condition}
            </span>
          )}
        </div>
      )}

      {availability && (
        <p
          className={`font-body ${metaSize} font-semibold ${
            status === "sold" ? "text-muted-foreground" : "text-primary"
          }`}
        >
          {availability}
        </p>
      )}
    </div>
  );
};

export default RecordCardInfo;
