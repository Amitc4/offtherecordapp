/**
 * @file SealedDiamond.tsx — Blue diamond badge overlaid on the top-right corner
 * of an album cover for records marked as sealed (still in original shrink wrap).
 *
 * Shared by the Collection and Discover tabs so the badge looks identical everywhere.
 *
 * @param small  – Compact variant used on 48px list thumbnails.
 * @param offset – Shift left so it doesn't collide with the perfect-score star.
 */
const SealedDiamond = ({ small = false, offset = false }: { small?: boolean; offset?: boolean }) => {
  const s = small ? 11 : 14;
  return (
    <div
      className={`absolute z-10 flex items-center justify-center rounded-full bg-white shadow-md ring-2 ring-card ${
        small
          ? `-top-1 ${offset ? "right-4" : "-right-1"} h-5 w-5`
          : `top-1.5 ${offset ? "right-9" : "right-1.5"} h-6 w-6`
      }`}
      title="Sealed record"
    >
      {/* Round brilliant-cut diamond, side profile (wedding ring style) */}
      <svg width={s} height={s} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <g stroke="hsl(217 91% 40%)" strokeWidth="0.8" strokeLinejoin="round" strokeLinecap="round">
          {/* Crown (wide top with girdle overhang) */}
          <path d="M1 9 L6 4 L18 4 L23 9 Z" fill="hsl(210 100% 75%)" />
          {/* Pavilion (V cone) */}
          <path d="M1 9 L12 22 L23 9 Z" fill="hsl(217 91% 60%)" />
          {/* Crown facets */}
          <path d="M6 4 L8 9 M18 4 L16 9 M8 9 L16 9" strokeWidth="0.6" fill="none" />
          {/* Pavilion facets */}
          <path d="M1 9 L12 9 L23 9 M6 9 L12 22 M18 9 L12 22 M12 9 L12 22" strokeWidth="0.6" fill="none" />
        </g>
      </svg>
    </div>
  );
};

export default SealedDiamond;
