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

    // Match marketplace records: case-insensitive PARTIAL artist matches, ranked by Spotify preference.
    // Discogs artist names often include suffixes like "*", " (2)" — wildcards make matching flexible.
    const cleanName = (s: string) =>
      s.toLowerCase().trim().replace(/\s*\*+\s*$/g, "").replace(/\s*\(\d+\)\s*$/g, "").trim();
    const lowerArtists = artistNames.map(cleanName).filter(Boolean);
    // Artist rank map: index 0 = most listened
    const artistRank = new Map<string, number>();
    lowerArtists.forEach((n, i) => { if (!artistRank.has(n)) artistRank.set(n, i); });

    let matches: any[] = [];
    if (lowerArtists.length) {
      // PostgREST .or() uses commas as separators and `*` as wildcard inside ilike values.
      const orFilter = lowerArtists
        .map((n) => {
          const safe = n.replace(/[,()]/g, " ").replace(/\s+/g, " ").trim();
          return `artist.ilike.*${safe}*`;
        })
        .join(",");
      const { data: records, error: recErr } = await admin
        .from("user_records")
        .select("id, title, artist, year, cover_image, condition, price, format, user_id, genre, created_at")
        .eq("status", "for_sale")
        .neq("user_id", userId)
        .or(orFilter)
        .limit(500);
      if (recErr) console.error("records query error", recErr);
      matches = records ?? [];
      console.log(`Spotify recs: ${lowerArtists.length} top artists, ${matches.length} matching listings`);
    }

    // Group listings by album (artist + title), keep one representative per album
    // (newest listing wins as the representative card).
    const albumMap = new Map<string, any>();
    for (const r of matches) {
      const artistLower = (r.artist ?? "").toLowerCase().trim();
      const titleLower = (r.title ?? "").toLowerCase().trim();
      const key = `${artistLower}|||${titleLower}`;
      const existing = albumMap.get(key);
      if (!existing) {
        albumMap.set(key, { ...r, _listing_count: 1 });
      } else {
        existing._listing_count += 1;
        // Prefer the newer listing as the representative
        if (new Date(r.created_at).getTime() > new Date(existing.created_at).getTime()) {
          albumMap.set(key, { ...r, _listing_count: existing._listing_count });
        }
      }
    }

    // Bucket albums by their artist's Spotify rank
    const buckets = new Map<number, any[]>();
    for (const album of albumMap.values()) {
      const artistLower = (album.artist ?? "").toLowerCase().trim();
      // Find matching artist rank (use first artist whose name appears in the record artist string)
      let rank = artistRank.get(artistLower);
      if (rank === undefined) {
        for (const [name, idx] of artistRank) {
          if (artistLower.includes(name) || name.includes(artistLower)) {
            rank = idx;
            break;
          }
        }
      }
      if (rank === undefined) rank = lowerArtists.length; // genre-only matches go last
      if (!buckets.has(rank)) buckets.set(rank, []);
      buckets.get(rank)!.push(album);
    }

    // Within each bucket, sort by recency so a single artist's "top" album is stable
    for (const list of buckets.values()) {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    // Round-robin interleave across artists in Spotify preference order
    const sortedRanks = [...buckets.keys()].sort((a, b) => a - b);
    const interleaved: any[] = [];
    let added = true;
    let round = 0;
    while (added) {
      added = false;
      for (const r of sortedRanks) {
        const list = buckets.get(r)!;
        if (list[round]) {
          interleaved.push(list[round]);
          added = true;
        }
      }
      round += 1;
    }

    return json({
      top_artists: artistNames.slice(0, 10),
      top_genres: genres.slice(0, 10),
      recommendations: interleaved,
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
