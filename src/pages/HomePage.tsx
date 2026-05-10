/**
 * @file HomePage.tsx — Main app shell with bottom tab navigation.
 *
 * Rendered after authentication. Contains:
 *
 * **Tabs (bottom nav bar):**
 * | Tab        | Screen             | Description                           |
 * |------------|--------------------|---------------------------------------|
 * | Collection | CollectionScreen   | User's vinyl records with CRUD        |
 * | Wishlist   | WishlistScreen     | Records the user wants                |
 * | Discover   | DiscoverScreen     | Browse other users' for-sale records  |
 * | Chats      | ChatsScreen        | Messaging + trade offers              |
 * | Profile    | ProfileScreen      | User info, friends, Discogs link      |
 * | Admin      | AdminScreen        | (Only shown if user has admin role)   |
 *
 * **Key behaviour:**
 * - `handleNavigateToChat(chatId, draft?)` allows the Discover screen to
 *   open a specific chat with a pre-filled draft message.
 * - An admin check runs on mount: if the user has role `admin` or `main_admin`
 *   in `user_roles`, the Admin tab is appended.
 * - Tab transitions use Framer Motion `AnimatePresence`.
 * - A scroll listener adds/removes an `is-scrolling` CSS class for hiding
 *   overlays during scroll.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Disc3, Heart, Compass, MessageCircle, User, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CollectionScreen from "@/components/screens/CollectionScreen";
import WishlistScreen from "@/components/screens/WishlistScreen";
import DiscoverScreen from "@/components/screens/DiscoverScreen";
import ChatsScreen from "@/components/screens/ChatsScreen";
import ProfileScreen from "@/components/screens/ProfileScreen";
import AdminScreen from "@/components/screens/AdminScreen";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadChats } from "@/hooks/useUnreadChats";
import { supabase } from "@/integrations/supabase/client";

type Tab = "collection" | "wishlist" | "discover" | "chats" | "profile" | "admin";

const baseTabs: { id: Tab; label: string; icon: typeof Disc3 }[] = [
  { id: "collection", label: "Collection", icon: Disc3 },
  { id: "wishlist", label: "Wishlist", icon: Heart },
  { id: "discover", label: "Discover", icon: Compass },
  { id: "chats", label: "Chats", icon: MessageCircle },
  { id: "profile", label: "Profile", icon: User },
];

const HomePage = () => {
  const [activeTab, setActiveTab] = useState<Tab>("discover");
  const [isAdmin, setIsAdmin] = useState(false);
  const [openChatId, setOpenChatId] = useState<number | null>(null);
  const [draftMessage, setDraftMessage] = useState<string>("");
  const { user } = useAuth();
  const mainRef = useRef<HTMLElement>(null);
  const scrollTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleScroll = useCallback(() => {
    mainRef.current?.classList.add("is-scrolling");
    clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      mainRef.current?.classList.remove("is-scrolling");
    }, 800);
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "main_admin"])
      .then(({ data }) => setIsAdmin(!!(data && data.length > 0)));
  }, [user]);

  const tabs = isAdmin
    ? [...baseTabs, { id: "admin" as Tab, label: "Admin", icon: ShieldCheck }]
    : baseTabs;

  const handleNavigateToChat = (chatId: number, draft?: string) => {
    setOpenChatId(chatId);
    setDraftMessage(draft || "");
    setActiveTab("chats");
  };

  const renderScreen = () => {
    switch (activeTab) {
      case "collection": return <CollectionScreen />;
      case "wishlist": return <WishlistScreen />;
      case "discover": return <DiscoverScreen onNavigateToChat={handleNavigateToChat} />;
      case "chats": return <ChatsScreen initialChatId={openChatId} initialDraft={draftMessage} onChatOpened={() => { setOpenChatId(null); setDraftMessage(""); }} />;
      case "profile": return <ProfileScreen />;
      case "admin": return <AdminScreen />;
    }
  };

  return (
    <div className="mx-auto flex h-screen max-w-md flex-col overflow-x-hidden bg-background">
      <main
        ref={mainRef}
        className="flex-1 scrollbar-overlay pb-20"
        onScroll={handleScroll}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {renderScreen()}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 border-t border-primary/20 bg-card/95 backdrop-blur-md">
        <div className="flex h-14 items-center justify-around px-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative flex flex-col items-center gap-0.5"
              >
                <div className="relative flex flex-col items-center">
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-full mb-1 h-0.5 w-5 rounded-full bg-primary"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <Icon
                    size={22}
                    className={`transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}
                    fill={isActive && tab.id === "wishlist" ? "hsl(var(--primary))" : "none"}
                  />
                </div>
                <span className={`font-body text-xs transition-colors ${isActive ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
        <div className="h-3 bg-card" />
      </nav>
    </div>
  );
};

export default HomePage;
