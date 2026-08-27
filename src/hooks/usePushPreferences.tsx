/**
 * @file usePushPreferences.tsx — Server-side push notification preferences.
 *
 * Backed by the `push_preferences` table (one row per user, RLS owner-only):
 * - `push_enabled`: master switch — when off, no push is delivered at all.
 * - `chat_message` / `friend_request` / `wishlist_match`: per-type opt-ins.
 *
 * The `send-push` edge function reads the same row before delivering, so these
 * settings apply to every device the user is subscribed on.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface PushPrefs {
  push_enabled: boolean;
  chat_message: boolean;
  friend_request: boolean;
  wishlist_match: boolean;
}

export const defaultPushPrefs: PushPrefs = {
  push_enabled: true,
  chat_message: true,
  friend_request: true,
  wishlist_match: true,
};

export function usePushPreferences() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<PushPrefs>(defaultPushPrefs);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("push_preferences")
      .select("push_enabled, chat_message, friend_request, wishlist_match")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) setPrefs({ ...defaultPushPrefs, ...data });
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Merge a partial change and upsert it for the signed-in user. */
  const update = useCallback(
    async (patch: Partial<PushPrefs>) => {
      if (!user) return { ok: false, error: "Please sign in first." };
      const next = { ...prefs, ...patch };
      setPrefs(next);
      const { error } = await supabase
        .from("push_preferences")
        .upsert({ user_id: user.id, ...next }, { onConflict: "user_id" });
      if (error) {
        setPrefs(prefs);
        return { ok: false, error: error.message };
      }
      return { ok: true };
    },
    [prefs, user],
  );

  return { prefs, loading, update, reload: load };
}
