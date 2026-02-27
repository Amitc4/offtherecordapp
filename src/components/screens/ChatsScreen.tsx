import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Send, HandshakeIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import CreateOfferDialog from "@/components/CreateOfferDialog";
import OfferCard from "@/components/OfferCard";

const chats = [
  { id: 1, name: "Sarah M.", record: "Blue Train", lastMessage: "Is the Coltrane still available?", time: "2m ago", unread: 2, otherUserId: "" },
  { id: 2, name: "Jake R.", record: "Rumours", lastMessage: "Deal! I'll pick it up tomorrow", time: "1h ago", unread: 1, otherUserId: "" },
  { id: 3, name: "Emily K.", record: "Abbey Road", lastMessage: "Thanks for the trade!", time: "3h ago", unread: 0, otherUserId: "" },
  { id: 4, name: "Marcus T.", record: "Kind of Blue", lastMessage: "What condition is the sleeve?", time: "1d ago", unread: 0, otherUserId: "" },
];

interface ChatMessage {
  id: number;
  text: string;
  sender: "me" | "them";
  time: string;
}

const mockMessages: Record<number, ChatMessage[]> = {
  1: [
    { id: 1, text: "Hey, I saw you have Blue Train listed", sender: "them", time: "10m ago" },
    { id: 2, text: "Yes! It's the 2010 reissue", sender: "me", time: "8m ago" },
    { id: 3, text: "Is the Coltrane still available?", sender: "them", time: "2m ago" },
  ],
  2: [
    { id: 1, text: "Would you take ₪90 for Rumours?", sender: "them", time: "2h ago" },
    { id: 2, text: "How about ₪100?", sender: "me", time: "1.5h ago" },
    { id: 3, text: "Deal! I'll pick it up tomorrow", sender: "them", time: "1h ago" },
  ],
  3: [
    { id: 1, text: "Abbey Road arrived safely!", sender: "them", time: "4h ago" },
    { id: 2, text: "Glad to hear it!", sender: "me", time: "3.5h ago" },
    { id: 3, text: "Thanks for the trade!", sender: "them", time: "3h ago" },
  ],
  4: [
    { id: 1, text: "I'm interested in Kind of Blue", sender: "them", time: "1d ago" },
    { id: 2, text: "What condition is the sleeve?", sender: "them", time: "1d ago" },
  ],
};

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

const ChatsScreen = () => {
  const { user } = useAuth();
  const [activeChat, setActiveChat] = useState<number | null>(null);
  const [messages, setMessages] = useState<Record<number, ChatMessage[]>>(mockMessages);
  const [inputText, setInputText] = useState("");
  const [showOfferDialog, setShowOfferDialog] = useState(false);
  const [offers, setOffers] = useState<TradeOffer[]>([]);

  const activeChatData = chats.find((c) => c.id === activeChat);

  const fetchOffers = useCallback(async () => {
    if (!activeChat || !user) return;
    const { data } = await supabase
      .from("trade_offers")
      .select("*")
      .eq("chat_id", activeChat)
      .order("created_at", { ascending: true });
    setOffers((data as TradeOffer[]) || []);
  }, [activeChat, user]);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  // Realtime subscription for offers
  useEffect(() => {
    if (!activeChat) return;
    const channel = supabase
      .channel(`offers-${activeChat}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "trade_offers", filter: `chat_id=eq.${activeChat}` }, () => {
        fetchOffers();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeChat, fetchOffers]);

  const handleSend = () => {
    if (!inputText.trim() || !activeChat) return;
    const newMsg: ChatMessage = {
      id: Date.now(),
      text: inputText.trim(),
      sender: "me",
      time: "now",
    };
    setMessages((prev) => ({
      ...prev,
      [activeChat]: [...(prev[activeChat] || []), newMsg],
    }));
    setInputText("");
  };

  if (activeChat && activeChatData) {
    const chatMessages = messages[activeChat] || [];

    // Interleave messages and offers by time (offers use created_at, messages use id as timestamp)
    type TimelineItem = { type: "message"; data: ChatMessage } | { type: "offer"; data: TradeOffer };
    const timeline: TimelineItem[] = [
      ...chatMessages.map((m) => ({ type: "message" as const, data: m })),
      ...offers.map((o) => ({ type: "offer" as const, data: o })),
    ];
    // Sort: messages by id (timestamp-ish), offers by created_at. Put offers after messages for mock data.
    timeline.sort((a, b) => {
      const timeA = a.type === "offer" ? new Date(a.data.created_at).getTime() : a.data.id;
      const timeB = b.type === "offer" ? new Date(b.data.created_at).getTime() : b.data.id;
      return timeA - timeB;
    });

    return (
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <button onClick={() => setActiveChat(null)} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-card active:bg-card/80">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 font-display text-sm font-bold text-primary">
            {activeChatData.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-body text-sm font-semibold text-foreground">{activeChatData.name}</h3>
            <p className="font-body text-[10px] font-medium text-primary">{activeChatData.record}</p>
          </div>
          <button
            onClick={() => setShowOfferDialog(true)}
            className="flex h-9 items-center gap-1.5 rounded-full bg-primary/15 px-3 font-body text-xs font-semibold text-primary transition-colors hover:bg-primary/25 active:scale-95"
          >
            <HandshakeIcon size={14} />
            <span>Offer</span>
          </button>
        </div>

        {/* Messages + Offers interleaved */}
        <div className="flex-1 overflow-y-auto px-4 py-3 pb-20 space-y-3">
          {timeline.map((item, idx) => {
            if (item.type === "message") {
              const msg = item.data;
              return (
                <div key={`msg-${msg.id}`} className={`flex ${msg.sender === "me" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-3.5 py-2 font-body text-sm ${
                      msg.sender === "me"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-card text-foreground rounded-bl-sm vinyl-shadow"
                    }`}
                  >
                    <p>{msg.text}</p>
                    <p className={`mt-1 text-[9px] ${msg.sender === "me" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      {msg.time}
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
                  senderName={offer.sender_id === user?.id ? "You" : activeChatData.name}
                  receiverName={offer.receiver_id === user?.id ? "You" : activeChatData.name}
                  onUpdate={fetchOffers}
                  onCounterOffer={() => setShowOfferDialog(true)}
                />
              );
            }
          })}
        </div>

        {/* Fixed input bar */}
        <div className="fixed bottom-[calc(3.5rem+0.75rem)] left-1/2 z-50 w-full max-w-md -translate-x-1/2 border-t border-border bg-background px-4 py-2">
          <div className="flex items-center gap-2">
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type a message..."
              className="flex-1 h-11 font-body text-sm"
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

        {/* Create Offer Dialog */}
        <CreateOfferDialog
          open={showOfferDialog}
          onOpenChange={setShowOfferDialog}
          chatId={activeChat}
          otherUserId={activeChatData.otherUserId}
          otherUserName={activeChatData.name}
          onOfferCreated={fetchOffers}
        />
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-2">
      <h1 className="mb-4 font-display text-2xl font-bold text-foreground">Chats</h1>

      <div className="space-y-1">
        {chats.map((chat) => (
          <div
            key={chat.id}
            onClick={() => setActiveChat(chat.id)}
            className="flex cursor-pointer items-center gap-3 rounded-xl p-3 transition-colors hover:bg-card"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 font-display text-sm font-bold text-primary">
              {chat.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-body text-sm font-semibold text-foreground">{chat.name}</h3>
                <span className="font-body text-[10px] text-muted-foreground">{chat.time}</span>
              </div>
              <p className="font-body text-[10px] font-medium text-primary">{chat.record}</p>
              <p className="truncate font-body text-xs text-muted-foreground">{chat.lastMessage}</p>
            </div>
            {chat.unread > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 font-body text-[10px] font-bold text-primary-foreground">
                {chat.unread}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatsScreen;
