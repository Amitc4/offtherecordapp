/**
 * @file push-subscribe — Web Push subscription management.
 *
 * GET  → returns the public VAPID key so the browser can subscribe.
 * POST → stores (upserts) the caller's push subscription.
 * DELETE → removes a subscription by endpoint.
 *
 * The caller must be signed in (JWT in the Authorization header).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";

  if (req.method === "GET") return json({ vapidPublicKey });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
  const userId = userData.user.id;

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (req.method === "DELETE") {
    const endpoint = typeof payload.endpoint === "string" ? payload.endpoint : "";
    if (!endpoint) return json({ error: "endpoint is required" }, 400);
    const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const sub = (payload.subscription ?? payload) as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  const endpoint = sub.endpoint;
  const p256dh = sub.keys?.p256dh;
  const auth = sub.keys?.auth;

  if (!endpoint || !p256dh || !auth || endpoint.length > 2000) {
    return json({ error: "Invalid subscription" }, 400);
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
      },
      { onConflict: "endpoint" },
    );

  if (error) return json({ error: error.message }, 400);
  return json({ ok: true });
});
