// Spotify recommendations: refreshes token if needed, fetches user's top artists/genres/tracks,
// then matches them against marketplace records (status = 'for_sale').
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
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
    const userId = userData.user.id;

    const clientId = Deno.env.get("SPOTIFY_CLIENT_ID");
    const clientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET");
    if (!clientId || !clientSecret) return json({ error: "Spotify not configured" }, 500);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: tokenRow, error: tokenErr } = await admin
      .from("spotify_tokens")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (tokenErr || !tokenRow) {
      return json({ error: "Spotify not connected" }, 404);
    }

    let accessToken: string = tokenRow.access_token;
    if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
      const refreshRes = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: "Basic " + btoa(`${clientId}:${clientSecret}`),
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: tokenRow.refresh_token,
        }),
      });
      const r = await refreshRes.json();
      if (!refreshRes.ok) {
        console.error("Refresh failed", r);
        return json({ error: "Failed to refresh Spotify token" }, 401);
      }
      accessToken = r.access_token;
      const expiresAt = new Date(Date.now() + (r.expires_in - 60) * 1000).toISOString();
      await admin.from("spotify_tokens").update({
        access_token: accessToken,
        expires_at: expiresAt,
        ...(r.refresh_token ? { refresh_token: r.refresh_token } : {}),
      }).eq("user_id", userId);
    }

    // Fetch user's top artists (medium term)
    const topArtistsRes = await fetch(
      "https://api.spotify.com/v1/me/top/artists?limit=30&time_range=medium_term",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const topArtists = await topArtistsRes.json();
    const artistNames: string[] = (topArtists.items ?? []).map((a: any) => a.name);
    const genres: string[] = Array.from(
      new Set((topArtists.items ?? []).flatMap((a: any) => a.genres ?? [])),
    );

    // Match marketplace records: case-insensitive artist matches
    const lowerArtists = artistNames.map((n) => n.toLowerCase());
    let matches: any[] = [];
    if (lowerArtists.length) {
      const orFilter = lowerArtists
        .map((n) => `artist.ilike.${n.replace(/,/g, "")}`)
        .join(",");
      const { data: records } = await admin
        .from("user_records")
        .select("id, title, artist, year, cover_image, condition, price, format, user_id, genre")
        .eq("status", "for_sale")
        .neq("user_id", userId)
        .or(orFilter)
        .limit(50);
      matches = records ?? [];
    }

    // Score: exact artist match = strong, genre overlap = weak
    const scored = matches.map((r) => {
      let score = 0;
      const artistLower = (r.artist ?? "").toLowerCase();
      if (lowerArtists.includes(artistLower)) score += 10;
      if (r.genre && genres.some((g) => r.genre.toLowerCase().includes(g.toLowerCase()))) score += 2;
      return { ...r, _score: score };
    }).sort((a, b) => b._score - a._score);

    return json({
      top_artists: artistNames.slice(0, 10),
      top_genres: genres.slice(0, 10),
      recommendations: scored,
    });
  } catch (e) {
    console.error("spotify-recommendations error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
