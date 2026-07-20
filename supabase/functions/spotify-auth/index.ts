/**
 * @file spotify-auth edge function — Spotify OAuth 2.0 (Authorization Code).
 *
 * Single endpoint that branches on a JSON `action` field:
 *  - `authorize`  — Builds the Spotify consent URL with the configured
 *                   scopes (top-read, library-read, recently-played, email)
 *                   and a random `state`; the client stashes the state and
 *                   redirects the browser.
 *  - `exchange`   — Swaps the returned `code` for access + refresh tokens,
 *                   fetches the Spotify profile, and upserts both into
 *                   `spotify_tokens` plus flags `profiles.spotify_connected`.
 *  - `disconnect` — Deletes the stored tokens and clears the profile flag.
 *
 * The client secret never leaves this function; tokens are stored server-side
 * and refreshed on demand by `spotify-recommendations`.
 */
// Spotify OAuth: handles authorize-URL generation, code exchange, and disconnect.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SCOPES = [
  "user-top-read",
  "user-library-read",
  "user-read-recently-played",
  "user-read-email",
].join(" ");

const ALLOWED_REDIRECT_ORIGINS = new Set([
  "https://offtherecordapp.lovable.app",
  "https://id-preview--cb001185-69e1-4b05-b54d-b8f03a2f28aa.lovable.app",
  "http://localhost:8080",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const clientId = Deno.env.get("SPOTIFY_CLIENT_ID");
    const clientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      return json({ error: "Spotify not configured" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    let userId: string | null = null;
    let verifiedRedirectUri: string | null = null;

    if (action === "authorize" || action === "disconnect") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: userData, error: userErr } = await supabase.auth.getUser(
        authHeader.replace("Bearer ", ""),
      );
      if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
      userId = userData.user.id;
    }

    // 1) Generate authorize URL
    if (action === "authorize") {
      const redirectUri = body.redirect_uri as string;
      if (!redirectUri) return json({ error: "redirect_uri required" }, 400);
      if (!isAllowedRedirectUri(redirectUri)) return json({ error: "Unsupported Spotify redirect URL" }, 400);
      const state = await createSignedState({ userId: userId!, redirectUri });
      const url = new URL("https://accounts.spotify.com/authorize");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("scope", SCOPES);
      url.searchParams.set("state", state);
      url.searchParams.set("show_dialog", "false");
      return json({ url: url.toString(), state });
    }

    // 2) Exchange auth code for tokens, store them
    if (action === "exchange") {
      const code = body.code as string;
      const state = body.state as string;
      if (!code || !state) return json({ error: "code & state required" }, 400);

      const statePayload = await verifySignedState(state);
      if (!statePayload || !isAllowedRedirectUri(statePayload.redirectUri)) {
        return json({ error: "Invalid Spotify connection state" }, 400);
      }
      userId = statePayload.userId;
      verifiedRedirectUri = statePayload.redirectUri;

      const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: "Basic " + btoa(`${clientId}:${clientSecret}`),
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: verifiedRedirectUri,
        }),
      });
      const tokenText = await tokenRes.text();
      let tokenJson: any = {};
      try { tokenJson = JSON.parse(tokenText); } catch { /* non-JSON */ }
      if (!tokenRes.ok) {
        console.error("Spotify token exchange failed", tokenRes.status, tokenText);
        return json({ error: "Token exchange failed", status: tokenRes.status, details: tokenJson?.error_description || tokenText }, 400);
      }

      // Fetch user profile
      const meRes = await fetch("https://api.spotify.com/v1/me", {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });
      const meText = await meRes.text();
      let me: any = {};
      try { me = JSON.parse(meText); } catch { /* non-JSON */ }
      if (!meRes.ok) {
        console.error("Spotify /me failed", meRes.status, meText);
        return json({
          error: meRes.status === 403
            ? "Spotify rejected your account. If the Spotify app is in Development Mode, the user's email must be added to the app's allowlist in the Spotify Developer Dashboard."
            : "Failed to fetch Spotify profile",
          status: meRes.status,
          details: meText,
        }, 400);
      }

      const expiresAt = new Date(Date.now() + (tokenJson.expires_in - 60) * 1000).toISOString();

      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      await admin.from("spotify_tokens").upsert({
        user_id: userId,
        access_token: tokenJson.access_token,
        refresh_token: tokenJson.refresh_token,
        expires_at: expiresAt,
        scope: tokenJson.scope,
        spotify_user_id: me?.id ?? null,
        spotify_display_name: me?.display_name ?? null,
      }, { onConflict: "user_id" });

      await admin.from("profiles").update({
        spotify_connected: true,
        spotify_username: me?.display_name ?? me?.id ?? null,
      }).eq("user_id", userId);

      return json({ success: true, display_name: me?.display_name ?? me?.id });
    }

    // 3) Disconnect
    if (action === "disconnect") {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      await admin.from("spotify_tokens").delete().eq("user_id", userId);
      await admin.from("profiles").update({
        spotify_connected: false,
        spotify_username: null,
      }).eq("user_id", userId);
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("spotify-auth error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isAllowedRedirectUri(redirectUri: string) {
  try {
    const url = new URL(redirectUri);
    return url.pathname === "/spotify/callback" && ALLOWED_REDIRECT_ORIGINS.has(url.origin);
  } catch {
    return false;
  }
}

async function createSignedState(payload: { userId: string; redirectUri: string }) {
  const encodedPayload = base64UrlEncode(JSON.stringify({
    ...payload,
    nonce: crypto.randomUUID(),
    exp: Date.now() + 10 * 60 * 1000,
  }));
  const signature = await sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

async function verifySignedState(state: string): Promise<{ userId: string; redirectUri: string } | null> {
  const [encodedPayload, signature] = state.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = await sign(encodedPayload);
  if (!timingSafeEqual(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (!payload.userId || !payload.redirectUri || typeof payload.exp !== "number") return null;
    if (Date.now() > payload.exp) return null;
    return { userId: payload.userId, redirectUri: payload.redirectUri };
  } catch {
    return null;
  }
}

async function sign(value: string) {
  const secret = Deno.env.get("SPOTIFY_CLIENT_SECRET") ?? "";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function base64UrlEncode(value: string) {
  return base64UrlEncodeBytes(new TextEncoder().encode(value));
}

function base64UrlEncodeBytes(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return new TextDecoder().decode(Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)));
}
