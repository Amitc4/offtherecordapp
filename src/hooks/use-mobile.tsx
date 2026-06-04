/**
 * @file use-mobile.tsx — Responsive breakpoint hook.
 *
 * Provides `useIsMobile()` which returns `true` when the viewport width is
 * below 768px. Listens to `matchMedia` change events so components re-render
 * automatically when the user resizes or rotates the device.
 */
import * as React from "react";

/** Tailwind `md` breakpoint — anything narrower is treated as a mobile layout. */
const MOBILE_BREAKPOINT = 768;

/** React hook that returns `true` on mobile viewports (<768px wide). */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
