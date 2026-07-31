/**
 * @file openChatWithSeller.ts — Helper for jumping straight into a conversation
 * with the owner of a record (used by wishlist-match notifications).
 *
 * Finds an existing chat for the (record, buyer, seller) triple or creates one,
 * then broadcasts an `otr:open-chat` window event carrying the chat id and a
 * pre-filled draft message. `HomePage` listens for that event and switches to
 * the Chats tab with the conversation open.
 */
import { supabase } from "@/integrations/supabase/client";

export const OPEN_CHAT_EVENT = "otr:open-chat";

export interface OpenChatDetail {
  chatId: number;
  draft: string;
}

/** Build the standard "I'm interested" opener for a record. */
export const buildInterestDraft = (title: string, artist?: string | null) =>
  `Hi! I'm interested in your "${title}"${artist ? ` by ${artist}` : ""} vinyl — is this still relevant?`;

/**
 * Opens (or creates) a chat between the current user and the record owner and
 * asks the app shell to navigate there with a pre-made message.
 * Returns true on success.
 */
export async function openChatForRecord(recordId: string, buyerId: string): Promise<boolean> {
  const { data: record } = await supabase
    .from("user_records")
    .select("id, user_id, title, artist")
    .eq("id", recordId)
    .maybeSingle();

  if (!record || record.user_id === buyerId) return false;

  const sellerId = record.user_id;
  const draft = buildInterestDraft(record.title, record.artist);

  const { data: existing } = await supabase
    .from("chats")
    .select("id")
    .eq("record_id", record.id)
    .or(
      `and(participant_1.eq.${buyerId},participant_2.eq.${sellerId}),and(participant_1.eq.${sellerId},participant_2.eq.${buyerId})`,
    );

  let chatId = existing?.[0]?.id as number | undefined;

  if (!chatId) {
    const { data: newChat, error } = await supabase
      .from("chats")
      .insert({
        participant_1: buyerId,
        participant_2: sellerId,
        record_id: record.id,
        record_title: record.title,
      })
      .select("id")
      .single();
    if (error || !newChat) return false;
    chatId = newChat.id;
  }

  window.dispatchEvent(
    new CustomEvent<OpenChatDetail>(OPEN_CHAT_EVENT, { detail: { chatId, draft } }),
  );
  return true;
}
