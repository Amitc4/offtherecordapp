const chats = [
  { id: 1, name: "Sarah M.", lastMessage: "Is the Coltrane still available?", time: "2m ago", unread: 2 },
  { id: 2, name: "Jake R.", lastMessage: "Deal! I'll pick it up tomorrow", time: "1h ago", unread: 1 },
  { id: 3, name: "Emily K.", lastMessage: "Thanks for the trade!", time: "3h ago", unread: 0 },
  { id: 4, name: "Marcus T.", lastMessage: "What condition is the sleeve?", time: "1d ago", unread: 0 },
];

const ChatsScreen = () => {
  return (
    <div className="px-4 pt-4 pb-2">
      <h1 className="mb-4 font-display text-xl font-bold text-foreground">Chats</h1>

      <div className="space-y-1">
        {chats.map((chat) => (
          <div key={chat.id} className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-card">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 font-display text-sm font-bold text-primary">
              {chat.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-body text-sm font-semibold text-foreground">{chat.name}</h3>
                <span className="font-body text-[10px] text-muted-foreground">{chat.time}</span>
              </div>
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
