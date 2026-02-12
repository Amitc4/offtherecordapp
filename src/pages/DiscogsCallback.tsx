import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discogs`;

const DiscogsCallback = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState("Connecting to Discogs...");

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const oauthToken = params.get("oauth_token");
      const oauthVerifier = params.get("oauth_verifier");

      if (!oauthToken || !oauthVerifier) {
        toast.error("Missing OAuth parameters");
        navigate("/");
        return;
      }

      if (!session) {
        setStatus("Waiting for authentication...");
        return;
      }

      const oauthSecretRaw = sessionStorage.getItem("discogs_oauth_secret");
      if (!oauthSecretRaw) {
        toast.error("OAuth session expired. Please try connecting again.");
        navigate("/");
        return;
      }
      let oauthSecret: string;
      try {
        const parsed = JSON.parse(oauthSecretRaw);
        if (parsed.expiry && Date.now() > parsed.expiry) {
          sessionStorage.removeItem("discogs_oauth_secret");
          toast.error("OAuth session expired. Please try connecting again.");
          navigate("/");
          return;
        }
        oauthSecret = parsed.secret;
      } catch {
        oauthSecret = oauthSecretRaw;
      }

      try {
        const resp = await fetch(
          `${FUNCTIONS_URL}?action=access_token&oauth_token=${oauthToken}&oauth_token_secret=${oauthSecret}&oauth_verifier=${oauthVerifier}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
          }
        );
        const data = await resp.json();
        if (data.error) throw new Error(data.error);

        sessionStorage.removeItem("discogs_oauth_secret");
        toast.success(`Connected to Discogs as ${data.username}!`);
      } catch (err: any) {
        toast.error(err.message || "Failed to connect to Discogs");
      }

      navigate("/");
    };

    handleCallback();
  }, [session, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="font-body text-sm text-muted-foreground">{status}</p>
      </div>
    </div>
  );
};

export default DiscogsCallback;
