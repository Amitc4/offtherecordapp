/**
 * @file useUnreadChats.tsx — Tracks which non-archived chats have new
 * messages from the other participant since the current user last read them.
 *
 * Used by the bottom nav (badge on the Chats tab) and ChatsScreen
 * (highlighting unopened conversations). Subscribes to global chat_messages
 * INSERTs and chats UPDATEs so the count updates in real time.
 */
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface UnreadChatsResult {
  unreadIds: Set<number>;
  total: number;
}

const EMPTY: UnreadChatsResult = { unreadIds: new Set<number>(), total: 0 };

export const useUnreadChats = (): UnreadChatsResult => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["unread-chats", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<UnreadChatsResult> => {
      if (!user) return EMPTY;
      const { data: chats } = await supabase
        .from("chats")
        .select("id, participant_1, participant_2, last_read_p1, last_read_p2, archived_by");
      if (!chats) return EMPTY;
      const visible = chats.filter((c: any) => !(c.archived_by || []).includes(user.id));
      const ids = visible.map((c: any) => c.id);
      if (!ids.length) return EMPTY;
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("chat_id, sender_id, created_at")
        .in("chat_id", ids)
        .neq("sender_id", user.id)
        .order("created_at", { ascending: false });
      const unread = new Set<number>();
      for (const c of visible as any[]) {
        const lastRead = c.participant_1 === user.id ? c.last_read_p1 : c.last_read_p2;
        const lastReadMs = lastRead ? new Date(lastRead).getTime() : 0;
        const hasNewer = msgs?.some(
          (m) => m.chat_id === c.id && new Date(m.created_at).getTime() > lastReadMs,
        );
        if (hasNewer) unread.add(c.id);
      }
      return { unreadIds: unread, total: unread.size };
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("unread-chats-global")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        () => queryClient.invalidateQueries({ queryKey: ["unread-chats", user.id] }),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chats" },
        () => queryClient.invalidateQueries({ queryKey: ["unread-chats", user.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return data ?? EMPTY;
};

/** Mark a chat as read for the current user (updates last_read_* timestamp). */
export const markChatRead = async (chatId: number, userId: string) => {
  const { data: chat } = await supabase
    .from("chats")
    .select("participant_1")
    .eq("id", chatId)
    .maybeSingle();
  if (!chat) return;
  const field = (chat as any).participant_1 === userId ? "last_read_p1" : "last_read_p2";
  await supabase
    .from("chats")
    .update({ [field]: new Date().toISOString() } as any)
    .eq("id", chatId);
};
