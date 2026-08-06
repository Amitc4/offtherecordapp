/**
 * @file VersionMarker.tsx — Unobtrusive build marker in the top-right corner.
 *
 * The value comes from `__APP_BUILD_ID__`, injected at build time by Vite
 * (short commit hash + build timestamp), so it changes on every publish and
 * reveals whether the device is showing a cached older bundle.
 */
const VersionMarker = () => (
  <span
    aria-label={`Build ${__APP_BUILD_ID__}`}
    className="pointer-events-none fixed right-2 top-1 z-[300] select-none font-body text-[10px] leading-none text-muted-foreground/50"
  >
    {__APP_BUILD_ID__}
  </span>
);

export default VersionMarker;
