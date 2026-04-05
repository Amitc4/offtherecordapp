/**
 * @file useNotifications.tsx — Hook for fetching and managing in-app notifications.
 *
 * Uses React Query to fetch the latest 50 notifications for the signed-in user,
 * and subscribes to Supabase Realtime so new notifications appear instantly
 * without a manual refresh.
 *
 * **Returned values:**
 * - `notifications` – Array of `Notification` objects sorted newest-first.
 * - `unreadCount`   – Number of notifications where `read === false`.
 * - `markAsRead(id)` – Marks a single notification as read.
 * - `markAllRead()`  – Marks every unread notification as read.
 * - All standard React Query state (`isLoading`, `isError`, etc.).
 */
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

/** Shape of a notification row from the `notifications` table. */
export interface Notification {
  id: string;
  user_id: string;
  type: string;        // e.g. "wishlist_match"
  title: string;
  body: string | null;
  record_id: string | null;
  from_user_id: string | null;
  read: boolean;
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ── Fetch notifications ──────────────────────────────────────────────
  const { data: notifications = [], ...rest } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!user,
  });

  // ── Realtime: auto-refresh when a new notification is inserted ───────
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  /** Count of unread notifications (drives the badge number on the bell icon). */
  const unreadCount = notifications.filter((n) => !n.read).length;

  /** Mark a single notification as read. */
  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true } as any).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
  };

  /** Mark all unread notifications as read (bulk). */
  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ read: true } as any).eq("user_id", user.id).eq("read", false);
    queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
  };

  return { notifications, unreadCount, markAsRead, markAllRead, ...rest };
}
