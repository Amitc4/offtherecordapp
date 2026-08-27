/**
 * @file send-push — Delivers Web Push messages for a new in-app notification.
 *
 * Called by a database trigger whenever a row is inserted into `notifications`.
 * Authenticated with a shared secret header (`x-push-secret`), never a user JWT.
 * Sends the payload to every stored subscription of the target user and prunes
 * subscriptions the push service reports as gone (404/410).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import webpush from "npm:web-push@3.6.7";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secret = Deno.env.get("PUSH_HOOK_SECRET");
  if (!secret || req.headers.get("x-push-secret") !== secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: {
    user_id?: string;
    type?: string;
    title?: string;
    body?: string | null;
    record_id?: string | null;
    from_user_id?: string | null;
    notification_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.user_id || !body.title) return json({ error: "user_id and title are required" }, 400);

  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!publicKey || !privateKey) return json({ error: "VAPID keys not configured" }, 500);

  webpush.setVapidDetails("mailto:support@offtherecordapp.lovable.app", publicKey, privateKey);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", body.user_id);

  if (error) return json({ error: error.message }, 400);
  if (!subs?.length) return json({ sent: 0 });

  const payload = JSON.stringify({
    title: body.title,
    body: body.body ?? "",
    type: body.type ?? "general",
    record_id: body.record_id ?? null,
    from_user_id: body.from_user_id ?? null,
    notification_id: body.notification_id ?? null,
  });

  let sent = 0;
  const stale: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) stale.push(s.id);
        else console.error("push failed", status, (err as Error).message);
      }
    }),
  );

  if (stale.length) {
    await admin.from("push_subscriptions").delete().in("id", stale);
  }

  return json({ sent, pruned: stale.length });
});
