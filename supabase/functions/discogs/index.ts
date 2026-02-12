import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const allowedOrigins = [
  "https://offtherecordapp.lovable.app",
  "https://id-preview--cb001185-69e1-4b05-b54d-b8f03a2f28aa.lovable.app",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

const DISCOGS_CONSUMER_KEY = Deno.env.get("DISCOGS_CONSUMER_KEY")!;
const DISCOGS_CONSUMER_SECRET = Deno.env.get("DISCOGS_CONSUMER_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader;
}

function createUserClient(authHeader: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
}

function createServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

// OAuth 1.0a signature helpers
function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, "%21")
    .replace(/\*/g, "%2A")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29");
}

async function hmacSha1(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data));
  const bytes = new Uint8Array(sig);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function generateNonce(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function makeOAuthRequest(
  method: string,
  url: string,
  oauthParams: Record<string, string>,
  tokenSecret = ""
): Promise<Response> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = generateNonce();

  const params: Record<string, string> = {
    oauth_consumer_key: DISCOGS_CONSUMER_KEY,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_version: "1.0",
    ...oauthParams,
  };

  const sortedParams = Object.keys(params)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join("&");

  const baseString = `${method}&${percentEncode(url)}&${percentEncode(sortedParams)}`;
  const signingKey = `${percentEncode(DISCOGS_CONSUMER_SECRET)}&${percentEncode(tokenSecret)}`;
  const signature = await hmacSha1(signingKey, baseString);

  params.oauth_signature = signature;

  const authHeader = Object.keys(params)
    .map((k) => `${percentEncode(k)}="${percentEncode(params[k])}"`)
    .join(", ");

  return fetch(url, {
    method,
    headers: {
      Authorization: `OAuth ${authHeader}`,
      "User-Agent": "OffTheRecordApp/1.0",
    },
  });
}

async function makeAuthenticatedGet(
  url: string,
  accessToken: string,
  accessSecret: string
): Promise<Response> {
  return makeOAuthRequest("GET", url, { oauth_token: accessToken }, accessSecret);
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    // ──── REQUEST TOKEN ────
    if (action === "request_token") {
      const authHeader = getAuthenticatedUser(req);
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      const callbackUrl = url.searchParams.get("callback_url") || "";
      const resp = await makeOAuthRequest(
        "GET",
        "https://api.discogs.com/oauth/request_token",
        { oauth_callback: callbackUrl }
      );
      const text = await resp.text();
      if (!resp.ok) {
        return new Response(JSON.stringify({ error: text }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const params = new URLSearchParams(text);
      return new Response(
        JSON.stringify({
          oauth_token: params.get("oauth_token"),
          oauth_token_secret: params.get("oauth_token_secret"),
          authorize_url: `https://www.discogs.com/oauth/authorize?oauth_token=${params.get("oauth_token")}`,
        }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ──── ACCESS TOKEN ────
    if (action === "access_token") {
      const authHeader = getAuthenticatedUser(req);
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const supabase = createUserClient(authHeader);
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      const userId = claimsData.claims.sub;

      const oauthToken = url.searchParams.get("oauth_token") || "";
      const oauthTokenSecret = url.searchParams.get("oauth_token_secret") || "";
      const oauthVerifier = url.searchParams.get("oauth_verifier") || "";

      const resp = await makeOAuthRequest(
        "POST",
        "https://api.discogs.com/oauth/access_token",
        { oauth_token: oauthToken, oauth_verifier: oauthVerifier },
        oauthTokenSecret
      );
      const text = await resp.text();
      if (!resp.ok) {
        return new Response(JSON.stringify({ error: text }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const params = new URLSearchParams(text);
      const accessToken = params.get("oauth_token")!;
      const accessSecret = params.get("oauth_token_secret")!;

      const identityResp = await makeAuthenticatedGet(
        "https://api.discogs.com/oauth/identity",
        accessToken,
        accessSecret
      );
      const identity = await identityResp.json();

      const serviceClient = createServiceClient();
      await serviceClient.from("discogs_tokens").upsert({
        user_id: userId,
        access_token: accessToken,
        access_secret: accessSecret,
        discogs_username: identity.username,
      }, { onConflict: "user_id" });

      await serviceClient.from("profiles").update({
        discogs_connected: true,
        discogs_username: identity.username,
      }).eq("user_id", userId);

      return new Response(
        JSON.stringify({ success: true, username: identity.username }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ──── SYNC COLLECTION ────
    if (action === "sync_collection") {
      const authHeader = getAuthenticatedUser(req);
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const supabase = createUserClient(authHeader);
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      const userId = claimsData.claims.sub;

      const serviceClient = createServiceClient();
      const { data: tokens } = await serviceClient
        .from("discogs_tokens")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (!tokens) {
        return new Response(JSON.stringify({ error: "Discogs not connected" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const username = tokens.discogs_username;
      let page = 1;
      const allReleases: any[] = [];

      while (page <= 5) {
        const resp = await makeAuthenticatedGet(
          `https://api.discogs.com/users/${username}/collection/folders/0/releases?page=${page}&per_page=50`,
          tokens.access_token,
          tokens.access_secret
        );
        const data = await resp.json();
        if (!data.releases || data.releases.length === 0) break;

        for (const r of data.releases) {
          const info = r.basic_information;
          allReleases.push({
            user_id: userId,
            discogs_release_id: info.id,
            title: info.title,
            artist: info.artists?.map((a: any) => a.name).join(", ") || "Unknown",
            year: info.year || null,
            cover_image: info.cover_image || null,
            format: info.formats?.map((f: any) => f.name).join(", ") || null,
          });
        }

        if (page >= data.pagination?.pages) break;
        page++;
      }

      await serviceClient.from("user_records").delete().eq("user_id", userId);
      if (allReleases.length > 0) {
        await serviceClient.from("user_records").insert(allReleases);
      }

      return new Response(
        JSON.stringify({ success: true, count: allReleases.length }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ──── SYNC WISHLIST (WANTLIST) ────
    if (action === "sync_wishlist") {
      const authHeader = getAuthenticatedUser(req);
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const supabase = createUserClient(authHeader);
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      const userId = claimsData.claims.sub;

      const serviceClient = createServiceClient();
      const { data: tokens } = await serviceClient
        .from("discogs_tokens")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (!tokens) {
        return new Response(JSON.stringify({ error: "Discogs not connected" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const username = tokens.discogs_username;
      let page = 1;
      const allWants: any[] = [];

      while (page <= 5) {
        const resp = await makeAuthenticatedGet(
          `https://api.discogs.com/users/${username}/wants?page=${page}&per_page=50`,
          tokens.access_token,
          tokens.access_secret
        );
        const data = await resp.json();
        if (!data.wants || data.wants.length === 0) break;

        for (const w of data.wants) {
          const info = w.basic_information;
          allWants.push({
            user_id: userId,
            discogs_release_id: info.id,
            title: info.title,
            artist: info.artists?.map((a: any) => a.name).join(", ") || "Unknown",
            year: info.year || null,
            cover_image: info.cover_image || null,
          });
        }

        if (page >= data.pagination?.pages) break;
        page++;
      }

      await serviceClient.from("user_wishlist").delete().eq("user_id", userId);
      if (allWants.length > 0) {
        await serviceClient.from("user_wishlist").insert(allWants);
      }

      return new Response(
        JSON.stringify({ success: true, count: allWants.length }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ──── SEARCH ────
    if (action === "search") {
      const query = (url.searchParams.get("q") || "").trim();
      if (!query || query.length > 200) {
        return new Response(JSON.stringify({ error: "Invalid query" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const resp = await fetch(
        `https://api.discogs.com/database/search?q=${encodeURIComponent(query)}&type=release&per_page=20&key=${DISCOGS_CONSUMER_KEY}&secret=${DISCOGS_CONSUMER_SECRET}`,
        { headers: { "User-Agent": "OffTheRecordApp/1.0" } }
      );
      const data = await resp.json();
      const results = (data.results || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        year: parseInt(r.year) || null,
        cover_image: r.cover_image || r.thumb || null,
        format: r.format?.join(", ") || null,
      }));

      return new Response(JSON.stringify({ results }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ──── DISCONNECT ────
    if (action === "disconnect") {
      const authHeader = getAuthenticatedUser(req);
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const supabase = createUserClient(authHeader);
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      const userId = claimsData.claims.sub;

      const serviceClient = createServiceClient();
      await serviceClient.from("discogs_tokens").delete().eq("user_id", userId);
      await serviceClient
        .from("profiles")
        .update({ discogs_connected: false, discogs_username: null })
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Discogs function error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
