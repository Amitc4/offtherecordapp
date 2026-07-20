/**
 * @file SpotifyCallback.tsx — OAuth callback handler for Spotify connection.
 * Receives ?code=... from Spotify, exchanges it via the spotify-auth edge function,
 * then redirects back to the home page.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Disc3 } from "lucide-react";
import { getSpotifyRedirectUri } from "@/lib/spotifyOAuth";

const SpotifyCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Connecting your Spotify account...");

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const error = params.get("error");

      if (error) {
        toast.error(`Spotify connection cancelled: ${error}`);
        navigate("/", { replace: true });
        return;
      }
      if (!code) {
        toast.error("Missing Spotify auth code");
        navigate("/", { replace: true });
        return;
      }

      const expectedState = sessionStorage.getItem("spotify_oauth_state");
      if (expectedState && state !== expectedState) {
        toast.error("Spotify state mismatch — please try again");
        navigate("/", { replace: true });
        return;
      }
      sessionStorage.removeItem("spotify_oauth_state");

      const redirectUri = getSpotifyRedirectUri();
      const { data, error: fnErr } = await supabase.functions.invoke("spotify-auth", {
        body: { action: "exchange", code, state, redirect_uri: redirectUri },
      });

      if (fnErr || data?.error) {
        toast.error(data?.error || fnErr?.message || "Failed to connect Spotify");
      } else {
        toast.success(`Spotify connected${data?.display_name ? ` as ${data.display_name}` : ""}!`);
      }
      navigate("/", { replace: true });
    };
    run();
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <Disc3 size={48} className="animate-spin text-primary" />
      <p className="font-body text-sm text-muted-foreground">{status}</p>
    </div>
  );
};

export default SpotifyCallback;
