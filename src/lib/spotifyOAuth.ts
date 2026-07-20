const STABLE_PREVIEW_ORIGIN = "https://id-preview--cb001185-69e1-4b05-b54d-b8f03a2f28aa.lovable.app";

const isEditorPreviewHost = (hostname: string) =>
  hostname.endsWith("lovableproject.com") || hostname === "localhost" || hostname === "127.0.0.1";

export const getSpotifyRedirectUri = () => {
  const origin = isEditorPreviewHost(window.location.hostname)
    ? STABLE_PREVIEW_ORIGIN
    : window.location.origin;

  return `${origin}/spotify/callback`;
};