/**
 * @file RecordInfoList.tsx — Shared vertical detail list shown below a record's image.
 *
 * Renders the record information as an ordered list of labelled rows:
 * record name, artist name, year of release, classifications (format / genre /
 * sealed, e.g. "Vinyl, LP, Album, Limited Edition"), condition and — when a
 * listing status is supplied (collection tab) — the availability row
 * ("For sale · ₪120", "Personal collection" or "Sold").
 */
import { textDirClass } from "@/lib/utils";

interface RecordInfoListProps {
  title: string;
  artist: string;
  year?: number | null;
  format?: string | null;
  genre?: string | null;
  sealed?: boolean | null;
  condition?: string | null;
  /** "for_sale" | "personal" | "sold" — omit to hide the availability row. */
  status?: string | null;
  price?: number | null;
}

const Row = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-start justify-between gap-3 border-b border-border/60 py-2 last:border-b-0">
    <span className="shrink-0 font-body text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </span>
    <span className="min-w-0 flex-1 text-right">{children}</span>
  </div>
);

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
  if (sealed) parts.push("Sealed");
  // Deduplicate case-insensitively, preserving order.
  const seen = new Set<string>();
  return parts.filter((p) => {
    const key = p.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const statusText = (status: string, price?: number | null) => {
  if (status === "for_sale") {
    return price != null ? `For sale · ₪${price}` : "For sale · Open to trade";
  }
  if (status === "sold") return "Sold";
  return "Personal collection";
};

const RecordInfoList = ({
  title,
  artist,
  year,
  format,
  genre,
  sealed,
  condition,
  status,
  price,
}: RecordInfoListProps) => {
  const classifications = buildClassifications(format, genre, sealed);

  return (
    <div className="rounded-xl border border-border bg-background/40 px-4 py-1">
      <Row label="Record">
        <span className={`font-display text-sm font-bold text-foreground ${textDirClass(title)}`}>
          {title}
        </span>
      </Row>
      <Row label="Artist">
        <span className={`font-display text-sm text-foreground ${textDirClass(artist)}`}>
          {artist}
        </span>
      </Row>
      <Row label="Released">
        <span className="font-body text-sm text-foreground">{year || "—"}</span>
      </Row>
      <Row label="Classification">
        <span className="font-body text-sm text-foreground">
          {classifications.length ? classifications.join(", ") : "—"}
        </span>
      </Row>
      {condition && (
        <Row label="Condition">
          <span className="font-body text-sm font-semibold text-primary">{condition}</span>
        </Row>
      )}
      {status && (
        <Row label="Status">
          <span
            className={`font-body text-sm font-semibold ${
              status === "sold" ? "text-muted-foreground" : "text-primary"
            }`}
          >
            {statusText(status, price)}
          </span>
        </Row>
      )}
    </div>
  );
};

export default RecordInfoList;
