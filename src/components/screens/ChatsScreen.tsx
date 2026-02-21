import { useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { Input } from "@/components/ui/input";

const chats = [
  { id: 1, name: "Sarah M.", record: "Blue Train", lastMessage: "Is the Coltrane still available?", time: "2m ago", unread: 2 },
  { id: 2, name: "Jake R.", record: "Rumours", lastMessage: "Deal! I'll pick it up tomorrow", time: "1h ago", unread: 1 },
  { id: 3, name: "Emily K.", record: "Abbey Road", lastMessage: "Thanks for the trade!", time: "3h ago", unread: 0 },
  { id: 4, name: "Marcus T.", record: "Kind of Blue", lastMessage: "What condition is the sleeve?", time: "1d ago", unread: 0 },
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

const ChatsScreen = () => {
  const [activeChat, setActiveChat] = useState<number | null>(null);
  const [messages, setMessages] = useState<Record<number, ChatMessage[]>>(mockMessages);
  const [inputText, setInputText] = useState("");

  const activeChatData = chats.find((c) => c.id === activeChat);

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
        </div>

        {/* Messages - extra bottom padding for fixed input bar */}
        <div className="flex-1 overflow-y-auto px-4 py-3 pb-20 space-y-3">
          {chatMessages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === "me" ? "justify-end" : "justify-start"}`}>
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
          ))}
        </div>

        {/* Fixed input bar - sits directly above the nav bar */}
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
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-2">
      <h1 className="mb-4 font-display text-xl font-bold text-foreground">Chats</h1>

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
