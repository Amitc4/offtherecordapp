import { useState } from "react";
import { User, Settings, LogOut, ChevronRight, Disc3, RefreshCw, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useDiscogsProfile, useDiscogsConnect, useDiscogsSync } from "@/hooks/useDiscogs";
import { toast } from "sonner";

const ProfileScreen = () => {
  const { user, signOut } = useAuth();
  const { data: profile } = useDiscogsProfile();
  const { startConnect } = useDiscogsConnect();
  const { syncCollection, syncWishlist, disconnect } = useDiscogsSync();
  const [connecting, setConnecting] = useState(false);

  const handleConnectDiscogs = async () => {
    setConnecting(true);
    try {
      const callbackUrl = `${window.location.origin}/discogs/callback`;
      const data = await startConnect(callbackUrl);
      // Store the token secret for the callback
      localStorage.setItem("discogs_oauth_secret", data.oauth_token_secret);
      // Redirect to Discogs authorization
      window.location.href = data.authorize_url;
    } catch (err: any) {
      toast.error(err.message || "Failed to start Discogs connection");
      setConnecting(false);
    }
  };

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "User";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="px-4 pt-4 pb-2">
      <h1 className="mb-4 font-display text-xl font-bold text-foreground">Profile</h1>

      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary font-display text-xl font-bold text-primary-foreground">
          {initial}
        </div>
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">{displayName}</h2>
          <p className="font-body text-sm text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      {/* Discogs Connection */}
      <div className="mb-6 rounded-xl bg-card p-4 vinyl-shadow">
        <div className="mb-3 flex items-center gap-2">
          <Disc3 size={18} className="text-primary" />
          <h3 className="font-display text-sm font-semibold text-foreground">Discogs</h3>
        </div>

        {profile?.discogs_connected ? (
          <div className="space-y-3">
            <p className="font-body text-xs text-muted-foreground">
              Connected as <span className="font-semibold text-primary">{profile.discogs_username}</span>
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => syncCollection.mutate()}
                disabled={syncCollection.isPending}
                className="flex-1 border-border font-body text-xs"
              >
                <RefreshCw size={14} className={`mr-1 ${syncCollection.isPending ? "animate-spin" : ""}`} />
                Sync Collection
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => syncWishlist.mutate()}
                disabled={syncWishlist.isPending}
                className="flex-1 border-border font-body text-xs"
              >
                <RefreshCw size={14} className={`mr-1 ${syncWishlist.isPending ? "animate-spin" : ""}`} />
                Sync Wishlist
              </Button>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
              className="w-full border-border font-body text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Unlink size={14} className="mr-1" />
              Disconnect Discogs
            </Button>
          </div>
        ) : (
          <div>
            <p className="mb-3 font-body text-xs text-muted-foreground">
              Connect your Discogs account to import your collection and wishlist.
            </p>
            <Button
              size="sm"
              onClick={handleConnectDiscogs}
              disabled={connecting}
              className="w-full bg-primary font-body text-xs font-semibold text-primary-foreground"
            >
              <Disc3 size={14} className={`mr-1 ${connecting ? "animate-spin" : ""}`} />
              {connecting ? "Connecting..." : "Connect Discogs Account"}
            </Button>
          </div>
        )}
      </div>

      {/* Menu items */}
      <div className="space-y-1">
        {[
          { icon: User, label: "Edit Profile" },
          { icon: Settings, label: "Settings" },
        ].map((item) => (
          <button
            key={item.label}
            className="flex w-full items-center gap-3 rounded-xl p-4 transition-colors hover:bg-card"
          >
            <item.icon size={18} className="text-muted-foreground" />
            <span className="flex-1 text-left font-body text-sm font-medium text-foreground">{item.label}</span>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        ))}
      </div>

      <div className="mt-8">
        <Button
          variant="outline"
          onClick={signOut}
          className="w-full border-border font-body text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut size={16} className="mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export default ProfileScreen;
