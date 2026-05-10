/**
 * @file ChatsScreen.tsx — Messaging and trade negotiation screen.
 *
 * Has two views:
 *
 * ### Chat List (default)
 * - Shows all non-archived conversations sorted by last update.
 * - Search bar filters by participant name or associated record title.
 * - Swipe / tap the archive button to hide a chat.
 * - Displays last message preview and timestamp.
 *
 * ### Active Chat (when a conversation is selected)
 * - Real-time message feed (text bubbles) via Supabase Realtime subscription.
 * - Trade offer cards interleaved in the timeline (accept / decline / confirm).
 * - "Offer" button opens `CreateOfferDialog` to propose a swap or purchase.
 * - "View Collection" button opens the other user's records in a bottom sheet.
 * - "Report / Block" flag icon for safety.
 * - Auto-scrolls to the latest message.
 *
 * **Props:**
 * - `initialChatId` / `initialDraft` – Allow the Discover screen to deep-link
 *   into a chat with a pre-composed message.
 *
 * @see CreateOfferDialog  – Dialog for creating a trade offer.
 * @see OfferCard          – Renders a single trade offer with action buttons.
 * @see UserCollectionSheet – View another user's collection.
 * @see ReportBlockDialog   – Report or block a user.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ArrowLeft, Send, HandshakeIcon, MessageCircle, Archive, ArchiveRestore, Eye, Flag, Search } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import CreateOfferDialog from "@/components/CreateOfferDialog";
import OfferCard from "@/components/OfferCard";
import UserCollectionSheet from "@/components/UserCollectionSheet";
import ReportBlockDialog from "@/components/ReportBlockDialog";
import UserReviewsSheet from "@/components/UserReviewsSheet";
import { useUnreadChats, markChatRead } from "@/hooks/useUnreadChats";

interface ChatRow {
  id: number;
  participant_1: string;
  participant_2: string;
  record_id: string | null;
  record_title: string | null;
  created_at: string;
  updated_at: string;
  archived_by: string[];
}

interface ChatMessage {
  id: string;
  chat_id: number;
  sender_id: string;
  text: string;
  created_at: string;
}

interface TradeOffer {
  id: string;
  sender_id: string;
  receiver_id: string;
  sender_cash: number;
  receiver_cash: number;
  status: string;
  sender_confirmed: boolean;
  receiver_confirmed: boolean;
  created_at: string;
}

interface ChatsScreenProps {
  initialChatId?: number | null;
  initialDraft?: string;
  onChatOpened?: () => void;
}

const ChatsScreen = ({ initialChatId, initialDraft, onChatOpened }: ChatsScreenProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeChat, setActiveChat] = useState<number | null>(null);
  const [inputText, setInputText] = useState("");
  const [showOfferDialog, setShowOfferDialog] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [offers, setOffers] = useState<TradeOffer[]>([]);
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({});
  const [viewingCollection, setViewingCollection] = useState(false);
  const [viewingReviews, setViewingReviews] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { unreadIds } = useUnreadChats();

  // Mark chat as read whenever it's opened or new messages arrive while open.
  useEffect(() => {
    if (!activeChat || !user) return;
    markChatRead(activeChat, user.id).then(() => {
      queryClient.invalidateQueries({ queryKey: ["unread-chats", user.id] });
    });
  }, [activeChat, user, queryClient]);

  // Toggle a body class while a chat is open so global floating buttons
  // (notifications bell, accessibility menu) can hide and not cover the Send button.
  useEffect(() => {
    if (activeChat) {
      document.body.classList.add("chat-open");
    } else {
      document.body.classList.remove("chat-open");
    }
    return () => document.body.classList.remove("chat-open");
  }, [activeChat]);

  // Handle initial chat navigation from Discover
  useEffect(() => {
    if (initialChatId) {
      setActiveChat(initialChatId);
      if (initialDraft) {
        setInputText(initialDraft);
      }
      onChatOpened?.();
    }
  }, [initialChatId, initialDraft, onChatOpened]);

  const [showArchived, setShowArchived] = useState(false);

  // Fetch all chats (including archived). Partition client-side.
  const { data: allChats = [], refetch: refetchChats } = useQuery({
    queryKey: ["chats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chats")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as ChatRow[];
    },
    enabled: !!user,
  });

  const chats = useMemo(
    () => allChats.filter((c) => !c.archived_by?.includes(user!.id)),
    [allChats, user]
  );
  const archivedChats = useMemo(
    () => allChats.filter((c) => c.archived_by?.includes(user!.id)),
    [allChats, user]
  );

  // Fetch participant display names (for both active and archived chats)
  useEffect(() => {
    if (!allChats.length || !user) return;
    const otherIds = [...new Set(allChats.map((c) => (c.participant_1 === user.id ? c.participant_2 : c.participant_1)))];
    if (!otherIds.length) return;

    supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", otherIds)
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((p) => { map[p.user_id] = p.display_name || "User"; });
          setParticipantNames(map);
        }
      });
  }, [allChats, user]);

  // Fetch messages for active chat
  const { data: messages = [] } = useQuery({
    queryKey: ["chat_messages", activeChat],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("chat_id", activeChat!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as ChatMessage[];
    },
    enabled: !!activeChat,
  });

  // Fetch last message per chat for preview (including archived)
  const { data: lastMessages = {} } = useQuery({
    queryKey: ["last_messages", allChats.map((c) => c.id).join(",")],
    queryFn: async () => {
      const map: Record<number, ChatMessage> = {};
      for (const chat of allChats) {
        const { data } = await supabase
          .from("chat_messages")
          .select("*")
          .eq("chat_id", chat.id)
          .order("created_at", { ascending: false })
          .limit(1);
        if (data && data.length > 0) {
          map[chat.id] = data[0] as ChatMessage;
        }
      }
      return map;
    },
    enabled: allChats.length > 0,
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime subscription for messages in the active chat.
  // Note: there is a window between the initial useQuery fetch and the channel
  // becoming SUBSCRIBED where INSERTs can be missed. We refetch once on
  // subscribe (and on reconnect) to backfill any gaps.
  useEffect(() => {
    if (!user || !activeChat) return;
    const channel = supabase
      .channel(`chat-messages-${activeChat}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `chat_id=eq.${activeChat}` },
        (payload) => {
          const msg = payload.new as ChatMessage;
          queryClient.setQueryData<ChatMessage[]>(["chat_messages", activeChat], (old = []) => {
            if (old.some((m) => m.id === msg.id)) return old;
            return [...old, msg];
          });
          queryClient.invalidateQueries({ queryKey: ["last_messages"] });
          queryClient.invalidateQueries({ queryKey: ["chats"] });
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // Backfill any messages that arrived between initial fetch and subscribe
          queryClient.invalidateQueries({ queryKey: ["chat_messages", activeChat] });
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [activeChat, user, queryClient]);

  // Fetch offers for active chat
  const fetchOffers = useCallback(async () => {
    if (!activeChat || !user) return;
    const { data } = await supabase
      .from("trade_offers")
      .select("*")
      .eq("chat_id", activeChat)
      .order("created_at", { ascending: true });
    setOffers((data as TradeOffer[]) || []);
  }, [activeChat, user]);

  useEffect(() => { fetchOffers(); }, [fetchOffers]);

  useEffect(() => {
    if (!activeChat) return;
    const channel = supabase
      .channel(`offers-${activeChat}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "trade_offers", filter: `chat_id=eq.${activeChat}` }, () => {
        fetchOffers();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          fetchOffers();
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [activeChat, fetchOffers]);

  const handleSend = async () => {
    if (!inputText.trim() || !activeChat || !user) return;
    const text = inputText.trim();
    setInputText("");

    await supabase.from("chat_messages").insert({
      chat_id: activeChat,
      sender_id: user.id,
      text,
    });
  };

  const handleArchiveChat = async (chatId: number) => {
    if (!user) return;
    const chat = allChats.find((c) => c.id === chatId);
    if (!chat) return;
    const newArchivedBy = Array.from(new Set([...(chat.archived_by || []), user.id]));
    await supabase.from("chats").update({ archived_by: newArchivedBy } as any).eq("id", chatId);
    refetchChats();
    toast.success("Chat archived");
  };

  const handleUnarchiveChat = async (chatId: number) => {
    if (!user) return;
    const chat = allChats.find((c) => c.id === chatId);
    if (!chat) return;
    const newArchivedBy = (chat.archived_by || []).filter((id) => id !== user.id);
    await supabase.from("chats").update({ archived_by: newArchivedBy } as any).eq("id", chatId);
    refetchChats();
    toast.success("Chat unarchived");
  };

  const activeChatData = allChats.find((c) => c.id === activeChat);
  const getOtherUserId = (chat: ChatRow) => chat.participant_1 === user?.id ? chat.participant_2 : chat.participant_1;
  const getOtherName = (chat: ChatRow) => participantNames[getOtherUserId(chat)] || "User";

  const [chatSearch, setChatSearch] = useState("");

  const sourceChats = showArchived ? archivedChats : chats;
  const filteredChats = useMemo(() => {
    if (!chatSearch.trim()) return sourceChats;
    const q = chatSearch.trim().toLowerCase();
    return sourceChats.filter((chat) => {
      const name = getOtherName(chat).toLowerCase();
      const recordTitle = (chat.record_title || "").toLowerCase();
      return name.includes(q) || recordTitle.includes(q);
    });
  }, [sourceChats, chatSearch, participantNames]);

  // Active chat view
  if (activeChat && activeChatData) {
    const otherName = getOtherName(activeChatData);
    const otherUserId = getOtherUserId(activeChatData);

    type TimelineItem = { type: "message"; data: ChatMessage } | { type: "offer"; data: TradeOffer };
    const timeline: TimelineItem[] = [
      ...messages.map((m) => ({ type: "message" as const, data: m })),
      ...offers.map((o) => ({ type: "offer" as const, data: o })),
    ];
    timeline.sort((a, b) => new Date(a.data.created_at).getTime() - new Date(b.data.created_at).getTime());

    return (
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <button onClick={() => setActiveChat(null)} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-card active:bg-card/80">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 font-display text-sm font-bold text-primary">
            {otherName.charAt(0)}
          </div>
          <button
            onClick={() => setViewingReviews(true)}
            className="min-w-0 flex-1 text-left"
          >
            <h3 className="font-body text-sm font-semibold text-foreground hover:text-primary truncate">{otherName}</h3>
            {activeChatData.record_title && (
              <p className="font-body text-[10px] font-medium text-primary truncate">{activeChatData.record_title}</p>
            )}
          </button>
          <button
            onClick={() => setViewingCollection(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary"
            title="View collection"
          >
            <Eye size={16} />
          </button>
          <button
            onClick={() => setReportOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title="Report or block user"
          >
            <Flag size={14} />
          </button>
          <button
            onClick={() => setShowOfferDialog(true)}
            className="flex h-9 items-center gap-1.5 rounded-full bg-primary/15 px-3 font-body text-xs font-semibold text-primary transition-colors hover:bg-primary/25 active:scale-95"
          >
            <HandshakeIcon size={14} />
            <span>Offer</span>
          </button>
        </div>

        {/* Messages + Offers */}
        <div className="flex-1 overflow-y-auto px-4 py-3 pb-20 space-y-3">
          {timeline.map((item) => {
            if (item.type === "message") {
              const msg = item.data;
              const isMe = msg.sender_id === user?.id;
              return (
                <div key={`msg-${msg.id}`} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-3.5 py-2 font-body text-sm ${
                      isMe
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-card text-foreground rounded-bl-sm vinyl-shadow"
                    }`}
                  >
                    <p>{msg.text}</p>
                    <p className={`mt-1 text-[9px] ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            } else {
              const offer = item.data;
              return (
                <OfferCard
                  key={`offer-${offer.id}`}
                  offer={offer}
                  senderName={offer.sender_id === user?.id ? "You" : otherName}
                  receiverName={offer.receiver_id === user?.id ? "You" : otherName}
                  onUpdate={fetchOffers}
                  onCounterOffer={() => setShowOfferDialog(true)}
                />
              );
            }
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Fixed input bar */}
        <div className="fixed bottom-[calc(3.5rem+0.75rem)] left-1/2 z-50 w-full max-w-md -translate-x-1/2 border-t border-border bg-background px-4 py-2">
          <div className="flex items-end gap-2">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Type a message..."
              rows={1}
              className="flex-1 min-h-[2.75rem] max-h-[4.5rem] resize-none overflow-y-auto rounded-md border border-input bg-background px-3 py-2.5 font-body text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              style={{ height: "auto" }}
              ref={(el) => {
                if (el) {
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 72) + "px";
                }
              }}
            />
            <button
              onClick={handleSend}
              disabled={!inputText.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-95 disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </div>
        </div>

        <CreateOfferDialog
          open={showOfferDialog}
          onOpenChange={setShowOfferDialog}
          chatId={activeChat}
          otherUserId={otherUserId}
          otherUserName={otherName}
          onOfferCreated={fetchOffers}
        />

        <UserCollectionSheet
          open={viewingCollection}
          onOpenChange={setViewingCollection}
          userId={otherUserId}
          userName={otherName}
        />

        <ReportBlockDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          targetUserId={otherUserId}
          targetUserName={otherName}
        />

        <UserReviewsSheet
          open={viewingReviews}
          onOpenChange={setViewingReviews}
          userId={otherUserId}
          userName={otherName}
        />
      </div>
    );
  }

  // Chat list view
  return (
    <div className="px-4 pt-4 pb-2">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="font-display text-3xl font-bold text-foreground">
          {showArchived ? "Archived" : "Chats"}
        </h1>
        <button
          onClick={() => { setShowArchived((v) => !v); setChatSearch(""); }}
          className="flex h-9 items-center gap-1.5 rounded-full bg-primary/15 px-3 font-body text-xs font-semibold text-primary transition-colors hover:bg-primary/25 active:scale-95"
        >
          {showArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
          <span>{showArchived ? "Back to Chats" : `Archived${archivedChats.length ? ` (${archivedChats.length})` : ""}`}</span>
        </button>
      </div>

      {sourceChats.length > 0 && (
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={chatSearch}
            onChange={(e) => setChatSearch(e.target.value)}
            placeholder="Search by name or record..."
            className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 font-body text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      )}

      {sourceChats.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          {showArchived ? (
            <>
              <Archive size={48} className="mb-4 text-muted-foreground/40" />
              <p className="font-display text-base font-semibold text-muted-foreground">No archived chats</p>
              <p className="mt-1 font-body text-sm text-muted-foreground">Completed trades with mutual reviews land here</p>
            </>
          ) : (
            <>
              <MessageCircle size={48} className="mb-4 text-muted-foreground/40" />
              <p className="font-display text-base font-semibold text-muted-foreground">No conversations yet</p>
              <p className="mt-1 font-body text-sm text-muted-foreground">Find a record in Discover and contact the seller</p>
            </>
          )}
        </div>
      ) : filteredChats.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <Search size={40} className="mb-3 text-muted-foreground/40" />
          <p className="font-body text-sm text-muted-foreground">No chats match your search</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filteredChats.map((chat) => {
            const otherName = getOtherName(chat);
            const last = lastMessages[chat.id];
            return (
              <div key={chat.id} className="relative overflow-hidden rounded-xl">
                {/* Archive button behind */}
                <div className="absolute right-0 top-0 bottom-0 flex items-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); showArchived ? handleUnarchiveChat(chat.id) : handleArchiveChat(chat.id); }}
                    className={`flex h-full w-16 items-center justify-center ${showArchived ? "bg-primary text-primary-foreground" : "bg-destructive text-destructive-foreground"}`}
                  >
                    {showArchived ? <ArchiveRestore size={18} /> : <Archive size={18} />}
                  </button>
                </div>
                {/* Chat row */}
                <div
                  onClick={() => setActiveChat(chat.id)}
                  className="relative flex cursor-pointer items-center gap-3 bg-background p-3 transition-colors hover:bg-card"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 font-display text-sm font-bold text-primary">
                    {otherName.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-body text-sm font-semibold text-foreground">{otherName}</h3>
                      {last && (
                        <span className="font-body text-[10px] text-muted-foreground">
                          {new Date(last.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                    {chat.record_title && (
                      <p className="font-body text-[10px] font-medium text-primary">{chat.record_title}</p>
                    )}
                    {last && (
                      <p className="truncate font-body text-xs text-muted-foreground">{last.text}</p>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); showArchived ? handleUnarchiveChat(chat.id) : handleArchiveChat(chat.id); }}
                    className={`ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${showArchived ? "text-muted-foreground hover:bg-primary/10 hover:text-primary" : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"}`}
                    title={showArchived ? "Unarchive chat" : "Archive chat"}
                  >
                    {showArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ChatsScreen;
