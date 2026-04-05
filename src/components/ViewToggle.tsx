/**
 * @file ViewToggle.tsx — Grid / List view toggle button pair.
 *
 * A small pill-shaped toggle with two icon buttons (grid and list).
 * The active view is highlighted with the primary color.
 * Used in Collection, Wishlist, and Discover screens.
 */

interface ViewToggleProps {
  view: "grid" | "list";
  onChange: (view: "grid" | "list") => void;
}

const ViewToggle = ({ view, onChange }: ViewToggleProps) => {
  return (
    <div className="inline-flex rounded-full overflow-hidden border border-primary/20">
      <button
        onClick={() => onChange("grid")}
        className={`flex h-9 w-9 items-center justify-center transition-colors ${
          view === "grid"
            ? "bg-primary text-primary-foreground"
            : "bg-primary/10 text-primary"
        }`}
      >
        <LayoutGrid size={16} />
      </button>
      <button
        onClick={() => onChange("list")}
        className={`flex h-9 w-9 items-center justify-center transition-colors ${
          view === "list"
            ? "bg-primary text-primary-foreground"
            : "bg-primary/10 text-primary"
        }`}
      >
        <List size={16} />
      </button>
    </div>
  );
};

export default ViewToggle;
