/**
 * @file usePushNotifications.tsx — Web Push subscription management on the client.
 *
 * Handles browser support detection, permission requests, subscribing to the
 * push service with the server's VAPID public key, and storing/removing the
 * subscription in the backend (`push_subscriptions` via the `push-subscribe`
 * edge function).
 *
 * Notes:
 * - Only works in the published/installed app (service workers are disabled in preview).
 * - On iOS, push requires the PWA to be added to the home screen.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

/** Convert a base64url VAPID key into the Uint8Array the Push API expects. */
const urlBase64ToUint8Array = (base64String: string): ArrayBuffer => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output.buffer;
};

export function usePushNotifications() {
  const { user } = useAuth();
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  // Detect support and reflect the current subscription state.
  useEffect(() => {
    const isSupported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(isSupported);
    if (!isSupported) return;

    let cancelled = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (!cancelled) setEnabled(!!sub && Notification.permission === "granted");
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  /** Ask for permission, subscribe, and persist the subscription in the backend. */
  const subscribe = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!supported) return { ok: false, error: "Push notifications aren't supported on this device." };
    if (!user) return { ok: false, error: "Please sign in first." };

    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return { ok: false, error: "Notification permission was denied." };

      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        return {
          ok: false,
          error: "Push works in the installed app — add Off The Record to your home screen and try again.",
        };
      }

      const { data, error } = await supabase.functions.invoke("push-subscribe", { method: "GET" });
      if (error) return { ok: false, error: "Couldn't reach the notification service." };
      const vapidPublicKey = (data as { vapidPublicKey?: string })?.vapidPublicKey;
      if (!vapidPublicKey) return { ok: false, error: "Push isn't configured on the server." };

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      const { error: saveError } = await supabase.functions.invoke("push-subscribe", {
        body: { subscription: sub.toJSON() },
      });
      if (saveError) return { ok: false, error: "Couldn't save this device." };

      setEnabled(true);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    } finally {
      setLoading(false);
    }
  }, [supported, user]);

  /** Remove the local subscription and delete it from the backend. */
  const unsubscribe = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await supabase.functions.invoke("push-subscribe", {
          method: "DELETE",
          body: { endpoint: sub.endpoint },
        });
        await sub.unsubscribe();
      }
      setEnabled(false);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    } finally {
      setLoading(false);
    }
  }, []);

  return { supported, enabled, loading, subscribe, unsubscribe };
}
