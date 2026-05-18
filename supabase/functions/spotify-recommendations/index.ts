// Spotify recommendations: refreshes token if needed, fetches user's top artists,
// then fuzzy-matches them against marketplace records (status = 'for_sale').
// Matching is normalized, accent/punctuation-insensitive, and bilingual (EN <-> HE).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---------- Normalization ----------
/** Lowercase, strip diacritics/punctuation/Discogs suffixes, collapse whitespace. */
function normalize(input: string): string {
  if (!input) return "";
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")          // strip diacritics
    .replace(/\s*\(\d+\)\s*$/g, "")           // Discogs "(2)" suffix
    .replace(/\s*\*+\s*$/g, "")               // Discogs "*" suffix
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")        // keep letters/numbers (any script) + spaces
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- Bilingual EN <-> HE artist mapping ----------
// Lightweight curated list. Extend as needed.
const BILINGUAL_ARTISTS: Array<[string, string]> = [
  ["tuna", "טונה"],
  ["omer adam", "עומר אדם"],
  ["dudu tassa", "דודו טסה"],
  ["shlomo artzi", "שלמה ארצי"],
  ["shalom hanoch", "שלום חנוך"],
  ["mashina", "משינה"],
  ["berry sakharof", "ברי סחרוף"],
  ["eviatar banai", "אביתר בנאי"],
  ["ehud banai", "אהוד בנאי"],
  ["meir banai", "מאיר בנאי"],
  ["arik einstein", "אריק איינשטיין"],
  ["ravid plotnik", "רביד פלוטניק"],
  ["jimbo j", "ג'ימבו ג'יי"],
  ["idan raichel", "עידן רייכל"],
  ["aviv geffen", "אביב גפן"],
  ["ninet tayeb", "נינט טייב"],
  ["static and ben el", "סטטיק ובן אל"],
  ["noa kirel", "נועה קירל"],
  ["eyal golan", "אייל גולן"],
  ["hadag nahash", "הדג נחש"],
];

const EN_TO_HE = new Map(BILINGUAL_ARTISTS.map(([en, he]) => [normalize(en), normalize(he)]));
const HE_TO_EN = new Map(BILINGUAL_ARTISTS.map(([en, he]) => [normalize(he), normalize(en)]));

function bilingualVariants(name: string): string[] {
  const n = normalize(name);
  const out = new Set<string>([n]);
  const he = EN_TO_HE.get(n); if (he) out.add(he);
  const en = HE_TO_EN.get(n); if (en) out.add(en);
  return [...out].filter(Boolean);
}

// ---------- Fuzzy matching ----------
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let curr = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const next = Math.min(curr + 1, prev[j] + 1, prev[j - 1] + cost);
      prev[j - 1] = curr;
      curr = next;
    }
    prev[b.length] = curr;
  }
  return prev[b.length];
}

/** Similarity 0..1 using normalized Levenshtein + substring boost. */
function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.95;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return 1 - dist / maxLen;
}

/** Best similarity of `candidate` against any of `targets` (already normalized). */
function bestMatch(candidate: string, targets: string[]): number {
  const c = normalize(candidate);
  if (!c) return 0;
  let best = 0;
  for (const t of targets) {
    const s = similarity(c, t);
    if (s > best) best = s;
    if (best === 1) break;
  }
  return best;
}

const MATCH_THRESHOLD = 0.72;

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

    if (tokenErr || !tokenRow) return json({ error: "Spotify not connected" }, 404);

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

    // Top artists
    const topArtistsRes = await fetch(
      "https://api.spotify.com/v1/me/top/artists?limit=30&time_range=medium_term",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const topArtists = await topArtistsRes.json();
    const artistNames: string[] = (topArtists.items ?? []).map((a: any) => a.name);
    const genres: string[] = Array.from(
      new Set((topArtists.items ?? []).flatMap((a: any) => a.genres ?? [])),
    );

    // Build rank map with bilingual variants
    type ArtistEntry = { rank: number; variants: string[] };
    const artistEntries: ArtistEntry[] = artistNames.map((name, i) => ({
      rank: i,
      variants: bilingualVariants(name),
    }));

    // Fetch all available marketplace listings (excluding caller's own).
    // Dataset is small; we fuzzy-match in memory for maximum flexibility.
    const { data: allRecords, error: recErr } = await admin
      .from("user_records")
      .select("id, title, artist, year, cover_image, condition, price, format, user_id, genre, created_at")
      .eq("status", "for_sale")
      .neq("user_id", userId)
      .limit(2000);
    if (recErr) console.error("records query error", recErr);

    type Scored = { record: any; rank: number; score: number };
    const scored: Scored[] = [];
    for (const rec of allRecords ?? []) {
      const recArtist = rec.artist ?? "";
      let bestRank = -1;
      let bestScore = 0;
      for (const entry of artistEntries) {
        const s = bestMatch(recArtist, entry.variants);
        if (s > bestScore) {
          bestScore = s;
          bestRank = entry.rank;
        }
      }
      if (bestScore >= MATCH_THRESHOLD) {
        scored.push({ record: rec, rank: bestRank, score: bestScore });
      }
    }

    console.log(
      `Spotify recs: ${artistNames.length} top artists, ${allRecords?.length ?? 0} listings scanned, ${scored.length} fuzzy matches`,
    );

    // Group listings by album (artist + title), keep newest as representative
    const albumMap = new Map<string, Scored & { _listing_count: number }>();
    for (const s of scored) {
      const key = `${normalize(s.record.artist)}|||${normalize(s.record.title)}`;
      const existing = albumMap.get(key);
      if (!existing) {
        albumMap.set(key, { ...s, _listing_count: 1 });
      } else {
        existing._listing_count += 1;
        if (
          new Date(s.record.created_at).getTime() >
          new Date(existing.record.created_at).getTime()
        ) {
          existing.record = s.record;
        }
        if (s.score > existing.score) {
          existing.score = s.score;
          existing.rank = s.rank;
        }
      }
    }

    // Bucket albums by rank
    const buckets = new Map<number, Array<typeof albumMap extends Map<any, infer V> ? V : never>>();
    for (const album of albumMap.values()) {
      const r = album.rank >= 0 ? album.rank : artistEntries.length;
      if (!buckets.has(r)) buckets.set(r, []);
      buckets.get(r)!.push(album);
    }

    // Within bucket: highest score first, then newest
    for (const list of buckets.values()) {
      list.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (
          new Date(b.record.created_at).getTime() -
          new Date(a.record.created_at).getTime()
        );
      });
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
          interleaved.push({ ...list[round].record, _match_score: list[round].score });
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
