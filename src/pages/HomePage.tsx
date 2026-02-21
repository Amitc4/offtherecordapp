import { useState, useEffect } from "react";
import { Disc3, Heart, Compass, MessageCircle, User, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CollectionScreen from "@/components/screens/CollectionScreen";
import WishlistScreen from "@/components/screens/WishlistScreen";
import DiscoverScreen from "@/components/screens/DiscoverScreen";
import ChatsScreen from "@/components/screens/ChatsScreen";
import ProfileScreen from "@/components/screens/ProfileScreen";
import AdminScreen from "@/components/screens/AdminScreen";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type Tab = "collection" | "wishlist" | "discover" | "chats" | "profile" | "admin";

const baseTabs: { id: Tab; label: string; icon: typeof Disc3 }[] = [
  { id: "collection", label: "Collection", icon: Disc3 },
  { id: "wishlist", label: "Wishlist", icon: Heart },
  { id: "discover", label: "Discover", icon: Compass },
  { id: "chats", label: "Chats", icon: MessageCircle },
  { id: "profile", label: "Profile", icon: User },
];

const unreadMessages = 3;

const HomePage = () => {
  const [activeTab, setActiveTab] = useState<Tab>("discover");
  const [isAdmin, setIsAdmin] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const tabs = isAdmin
    ? [...baseTabs, { id: "admin" as Tab, label: "Admin", icon: ShieldCheck }]
    : baseTabs;

  const renderScreen = () => {
    switch (activeTab) {
      case "collection": return <CollectionScreen />;
      case "wishlist": return <WishlistScreen />;
      case "discover": return <DiscoverScreen />;
      case "chats": return <ChatsScreen />;
      case "profile": return <ProfileScreen />;
      case "admin": return <AdminScreen />;
    }
  };

  return (
    <div className="mx-auto flex h-screen max-w-md flex-col bg-background">
      <main className="flex-1 overflow-y-auto pb-20">
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

      <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 border-t border-primary/20 bg-card/95 backdrop-blur-md md:hidden">
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
                  {tab.id === "chats" && unreadMessages > 0 && (
                    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 font-body text-[10px] font-bold text-primary-foreground">
                      {unreadMessages}
                    </span>
                  )}
                </div>
                <span className={`font-body text-[10px] transition-colors ${isActive ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
        <div className="h-safe-area-inset-bottom bg-card" />
      </nav>
    </div>
  );
};

export default HomePage;
