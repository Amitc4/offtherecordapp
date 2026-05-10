/**
 * @file ProfileScreen.tsx — User profile, friends, settings, and Discogs integration.
 *
 * **Sections:**
 * 1. **Header** – Avatar (with camera upload), display name, email, copyable short ID.
 * 2. **Stats cubes** – Records count, Wishlist count, Completed trades, Rating.
 * 3. **Pending friend requests** – Accept / reject incoming requests.
 * 4. **Friends list** – Search by name or ID, send requests, view a friend's collection.
 * 5. **Menu items:**
 *    - Edit Profile (opens `EditProfileSheet`)
 *    - Transaction History (opens `TransactionHistorySheet`)
 *    - Grading History, Notification Settings, Help, Settings (placeholders).
 * 6. **Discogs integration** – Connect / disconnect, sync collection, sync wishlist.
 * 7. **Sign Out** button.
 *
 * @see EditProfileSheet          – Bottom sheet for editing personal info.
 * @see TransactionHistorySheet   – Completed trade history.
 * @see UserCollectionSheet       – View another user's collection (from friends list).
 */
import { useState, useEffect, useRef } from "react";
import { User, Settings, LogOut, ChevronRight, Disc3, Heart, Package, Star, RefreshCw, Unlink, Clock, Bell, HelpCircle, Pencil, Users, UserPlus, Search, Check, X, Copy, Eye, Camera, Music, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useDiscogsProfile, useDiscogsConnect, useDiscogsSync, useUserRecords, useUserWishlist } from "@/hooks/useDiscogs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import UserCollectionSheet from "@/components/UserCollectionSheet";
import EditProfileSheet from "@/components/EditProfileSheet";
import TransactionHistorySheet from "@/components/TransactionHistorySheet";
import GradingHistorySheet from "@/components/GradingHistorySheet";
import NotificationSettingsSheet from "@/components/NotificationSettingsSheet";
import HelpSupportSheet from "@/components/HelpSupportSheet";
import SettingsSheet from "@/components/SettingsSheet";
import SpotifyRecommendationsSheet from "@/components/SpotifyRecommendationsSheet";

interface FriendRow {
  id: string;
  user_id: string;
  friend_id: string;
  status: string;
  created_at: string;
}

interface ProfileRow {
  user_id: string;
  display_name: string | null;
  short_id: string | null;
  avatar_url: string | null;
  nickname: string | null;
  first_name: string | null;
  last_name: string | null;
}

const ProfileScreen = () => {
  const { user, signOut } = useAuth();
  const { data: profile } = useDiscogsProfile();
  const { startConnect } = useDiscogsConnect();
  const { syncCollection, syncWishlist, disconnect } = useDiscogsSync();
  const { data: records = [] } = useUserRecords();
  const { data: wishlist = [] } = useUserWishlist();
  const [connecting, setConnecting] = useState(false);

  // Friends state
  const [showFriends, setShowFriends] = useState(false);
  const [showPendingRequests, setShowPendingRequests] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProfileRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [friends, setFriends] = useState<(FriendRow & { profile?: ProfileRow })[]>([]);
  const [pendingRequests, setPendingRequests] = useState<(FriendRow & { profile?: ProfileRow })[]>([]);
  const [myShortId, setMyShortId] = useState<string | null>(null);
  const [viewingUser, setViewingUser] = useState<{ id: string; name: string } | null>(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [transactionHistoryOpen, setTransactionHistoryOpen] = useState(false);
  const [gradingHistoryOpen, setGradingHistoryOpen] = useState(false);
  const [notifSettingsOpen, setNotifSettingsOpen] = useState(false);
  const [helpSupportOpen, setHelpSupportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [myProfile, setMyProfile] = useState<ProfileRow | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyUsername, setSpotifyUsername] = useState<string | null>(null);
  const [spotifyConnecting, setSpotifyConnecting] = useState(false);
  const [spotifyRecsOpen, setSpotifyRecsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("user_id, short_id, display_name, avatar_url, nickname, first_name, last_name, spotify_connected, spotify_username").eq("user_id", user.id).single()
      .then(({ data }) => {
        setMyShortId(data?.short_id || null);
        setMyProfile(data as ProfileRow | null);
        setSpotifyConnected(!!(data as any)?.spotify_connected);
        setSpotifyUsername((data as any)?.spotify_username ?? null);
      });
    supabase
      .from("trade_offers")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .then(({ count }) => setCompletedCount(count || 0));
    loadFriends();
  }, [user]);

  const loadFriends = async () => {
    if (!user) return;
    const { data: friendRows } = await supabase
      .from("friends")
      .select("*")
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

    if (!friendRows) return;

    const otherIds = friendRows.map(f => f.user_id === user.id ? f.friend_id : f.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, short_id, avatar_url, nickname, first_name, last_name")
      .in("user_id", otherIds.length ? otherIds : ["none"]);

    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

    const accepted = friendRows
      .filter(f => f.status === "accepted")
      .map(f => ({ ...f, profile: profileMap.get(f.user_id === user.id ? f.friend_id : f.user_id) }));

    const pending = friendRows
      .filter(f => f.status === "pending" && f.friend_id === user.id)
      .map(f => ({ ...f, profile: profileMap.get(f.user_id) }));

    setFriends(accepted);
    setPendingRequests(pending);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !user) return;
    setSearching(true);
    try {
      const q = searchQuery.trim();
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, short_id, avatar_url, nickname, first_name, last_name")
        .neq("user_id", user.id)
        .or(`display_name.ilike.%${q}%,short_id.ilike.%${q}%`)
        .limit(10);
      setSearchResults(data || []);
    } finally {
      setSearching(false);
    }
  };

  const sendFriendRequest = async (targetUserId: string) => {
    if (!user) return;
    const { error } = await supabase.from("friends").insert({
      user_id: user.id,
      friend_id: targetUserId,
    });
    if (error) {
      if (error.code === "23505") toast.info("Friend request already sent");
      else toast.error("Failed to send request");
    } else {
      toast.success("Friend request sent!");
      setSearchResults(prev => prev.filter(p => p.user_id !== targetUserId));
      loadFriends();
    }
  };

  const acceptRequest = async (requestId: string) => {
    const { error } = await supabase.from("friends").update({ status: "accepted" }).eq("id", requestId);
    if (error) toast.error("Failed to accept");
    else { toast.success("Friend added!"); loadFriends(); }
  };

  const rejectRequest = async (requestId: string) => {
    const { error } = await supabase.from("friends").delete().eq("id", requestId);
    if (error) toast.error("Failed to reject");
    else { toast.success("Request removed"); loadFriends(); }
  };

  const removeFriend = async (friendshipId: string) => {
    const { error } = await supabase.from("friends").delete().eq("id", friendshipId);
    if (error) toast.error("Failed to remove friend");
    else { toast.success("Friend removed"); loadFriends(); }
  };

  const copyId = () => {
    if (myShortId) {
      navigator.clipboard.writeText(myShortId);
      toast.success("ID copied!");
    }
  };

  const handleConnectDiscogs = async () => {
    setConnecting(true);
    try {
      const callbackUrl = `${window.location.origin}/discogs/callback`;
      const data = await startConnect(callbackUrl);
      sessionStorage.setItem("discogs_oauth_secret", JSON.stringify({
        secret: data.oauth_token_secret,
        expiry: Date.now() + 600000,
      }));
      window.location.href = data.authorize_url;
    } catch (err: any) {
      toast.error(err.message || "Failed to start Discogs connection");
      setConnecting(false);
    }
  };

  const handleConnectSpotify = async () => {
    setSpotifyConnecting(true);
    try {
      const redirectUri = `${window.location.origin}/spotify/callback`;
      const { data, error } = await supabase.functions.invoke("spotify-auth", {
        body: { action: "authorize", redirect_uri: redirectUri },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      sessionStorage.setItem("spotify_oauth_state", data.state);
      window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || "Failed to start Spotify connection");
      setSpotifyConnecting(false);
    }
  };

  const handleDisconnectSpotify = async () => {
    const { data, error } = await supabase.functions.invoke("spotify-auth", {
      body: { action: "disconnect" },
    });
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Failed to disconnect");
    } else {
      setSpotifyConnected(false);
      setSpotifyUsername(null);
      toast.success("Spotify disconnected");
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("user_id", user.id);
      if (updateError) throw updateError;
      setMyProfile(prev => prev ? { ...prev, avatar_url: avatarUrl } : prev);
      toast.success("Profile picture updated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const nicknameDisplay = myProfile?.nickname || profile?.display_name || user?.email?.split("@")[0] || "User";
  const fullName = [myProfile?.first_name, myProfile?.last_name].filter(Boolean).join(" ");
  const displayName = nicknameDisplay;
  const initial = nicknameDisplay.charAt(0).toUpperCase();
  const avatarUrl = myProfile?.avatar_url;

  const stats = [
    { icon: Disc3, value: records.length, label: "Records" },
    { icon: Heart, value: wishlist.length, label: "Wishlist" },
    { icon: Package, value: completedCount, label: "Sold / Swapped" },
    { icon: Star, value: "0.0", label: "Rating" },
  ];

  const menuItems = [
    { icon: Pencil, label: "Edit Profile" },
    { icon: Clock, label: "Grading History" },
    { icon: Package, label: "Transaction History" },
    { icon: Bell, label: "Notification Settings" },
    { icon: HelpCircle, label: "Help & Support" },
    { icon: Settings, label: "Settings" },
  ];

  return (
    <div className="px-4 pt-4 pb-2">
      <h1 className="mb-4 font-display text-3xl font-bold text-foreground tracking-wide">Profile</h1>

      <div className="mb-6 flex items-center gap-4">
        <div className="relative">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary font-display text-xl font-bold text-primary-foreground">
              {initial}
            </div>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
          >
            <Camera size={13} />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold text-foreground truncate">{nicknameDisplay}</h2>
          {fullName && <p className="font-body text-sm text-muted-foreground truncate">{fullName}</p>}
          <p className="font-body text-xs text-muted-foreground truncate">{user?.email}</p>
          {myShortId && (
            <button onClick={copyId} className="mt-1 flex items-center gap-1 font-body text-xs text-primary hover:underline">
              <Copy size={12} />
              ID: {myShortId}
            </button>
          )}
        </div>
      </div>

      {/* Stats Cubes */}
      <div className="mb-6 grid grid-cols-4 gap-2">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="flex flex-col items-center rounded-xl bg-card p-3 vinyl-shadow">
              <Icon size={22} className="mb-1.5 text-primary" fill={stat.icon === Heart ? "hsl(var(--primary))" : "none"} />
              <span className="font-display text-base font-bold text-foreground">{stat.value}</span>
              <span className="font-body text-[9px] text-muted-foreground text-center leading-tight">{stat.label}</span>
            </div>
          );
        })}
      </div>

      {/* Pending Friend Requests */}
      {pendingRequests.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowPendingRequests(!showPendingRequests)}
            className="flex w-full items-center gap-3 rounded-xl bg-primary/10 p-4 transition-colors hover:bg-primary/15"
          >
            <UserPlus size={18} className="text-primary" />
            <span className="flex-1 text-left font-body text-sm font-semibold text-foreground">Pending Friend Requests</span>
            <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-primary px-2 font-body text-xs font-bold text-primary-foreground">
              {pendingRequests.length}
            </span>
            <ChevronRight size={16} className={`text-muted-foreground transition-transform ${showPendingRequests ? "rotate-90" : ""}`} />
          </button>

          {showPendingRequests && (
            <div className="mt-2 space-y-2 rounded-xl bg-card p-3 vinyl-shadow">
              {pendingRequests.map((req) => (
                <div key={req.id} className="flex items-center gap-3 rounded-lg bg-background p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 font-display text-sm font-bold text-primary">
                    {(req.profile?.display_name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-sm font-medium text-foreground">{req.profile?.display_name || "Unknown"}</p>
                    <p className="font-body text-[10px] text-muted-foreground">ID: {req.profile?.short_id}</p>
                  </div>
                  <button onClick={() => acceptRequest(req.id)} className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check size={14} />
                  </button>
                  <button onClick={() => rejectRequest(req.id)} className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Friends Section */}
      <div className="mb-6 rounded-xl bg-card p-4 vinyl-shadow">
        <button onClick={() => setShowFriends(!showFriends)} className="flex w-full items-center gap-2">
          <Users size={18} className="text-primary" />
          <h3 className="flex-1 text-left font-display text-sm font-semibold text-foreground">
            Friends ({friends.length})
          </h3>
          {pendingRequests.length > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 font-body text-[10px] font-bold text-primary-foreground">
              {pendingRequests.length}
            </span>
          )}
          <ChevronRight size={16} className={`text-muted-foreground transition-transform ${showFriends ? "rotate-90" : ""}`} />
        </button>

        {showFriends && (
          <div className="mt-4 space-y-4">
            {/* Search */}
            <div className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search by name or ID..."
                className="flex-1 h-10 font-body text-sm"
              />
              <button
                onClick={handleSearch}
                disabled={searching || !searchQuery.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40"
              >
                <Search size={16} />
              </button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-2">
                <p className="font-body text-xs font-medium text-muted-foreground">Results</p>
                {searchResults.map((result) => (
                  <div key={result.user_id} className="flex items-center gap-3 rounded-lg bg-background p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 font-display text-sm font-bold text-primary">
                      {(result.display_name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-sm font-medium text-foreground">{result.display_name || "Unknown"}</p>
                      <p className="font-body text-[10px] text-muted-foreground">ID: {result.short_id}</p>
                    </div>
                    <button onClick={() => sendFriendRequest(result.user_id)} className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <UserPlus size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Pending Requests */}
            {pendingRequests.length > 0 && (
              <div className="space-y-2">
                <p className="font-body text-xs font-medium text-muted-foreground">Pending Requests</p>
                {pendingRequests.map((req) => (
                  <div key={req.id} className="flex items-center gap-3 rounded-lg bg-background p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 font-display text-sm font-bold text-primary">
                      {(req.profile?.display_name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-sm font-medium text-foreground">{req.profile?.display_name || "Unknown"}</p>
                    </div>
                    <button onClick={() => acceptRequest(req.id)} className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check size={14} />
                    </button>
                    <button onClick={() => rejectRequest(req.id)} className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Friends List */}
            {friends.length > 0 ? (
              <div className="space-y-2">
                <p className="font-body text-xs font-medium text-muted-foreground">Your Friends</p>
                {friends.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 rounded-lg bg-background p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 font-display text-sm font-bold text-primary">
                      {(f.profile?.display_name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-sm font-medium text-foreground">{f.profile?.display_name || "Unknown"}</p>
                    </div>
                    <button
                      onClick={() => setViewingUser({ id: f.user_id === user?.id ? f.friend_id : f.user_id, name: f.profile?.display_name || "Unknown" })}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      title="View collection"
                    >
                      <Eye size={14} />
                    </button>
                    <button onClick={() => removeFriend(f.id)} className="font-body text-[10px] text-muted-foreground hover:text-destructive">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center font-body text-xs text-muted-foreground py-2">No friends yet. Search to add some!</p>
            )}
          </div>
        )}
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
              <Button size="sm" variant="outline" onClick={() => syncCollection.mutate()} disabled={syncCollection.isPending} className="flex-1 border-border font-body text-xs">
                <RefreshCw size={14} className={`mr-1 ${syncCollection.isPending ? "animate-spin" : ""}`} />
                Sync Collection
              </Button>
              <Button size="sm" variant="outline" onClick={() => syncWishlist.mutate()} disabled={syncWishlist.isPending} className="flex-1 border-border font-body text-xs">
                <RefreshCw size={14} className={`mr-1 ${syncWishlist.isPending ? "animate-spin" : ""}`} />
                Sync Wishlist
              </Button>
            </div>
            <Button size="sm" variant="outline" onClick={() => disconnect.mutate()} disabled={disconnect.isPending} className="w-full border-border font-body text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
              <Unlink size={14} className="mr-1" />
              Disconnect Discogs
            </Button>
          </div>
        ) : (
          <div>
            <p className="mb-3 font-body text-xs text-muted-foreground">
              Connect your Discogs account to import your collection and wishlist.
            </p>
            <Button size="sm" onClick={handleConnectDiscogs} disabled={connecting} className="w-full bg-primary font-body text-xs font-semibold text-primary-foreground">
              <Disc3 size={14} className={`mr-1 ${connecting ? "animate-spin" : ""}`} />
              {connecting ? "Connecting..." : "Connect Discogs Account"}
            </Button>
          </div>
        )}
      </div>

      {/* Spotify Connection */}
      <div className="mb-6 rounded-xl bg-card p-4 vinyl-shadow">
        <div className="mb-3 flex items-center gap-2">
          <Music size={18} className="text-primary" />
          <h3 className="font-display text-sm font-semibold text-foreground">Spotify</h3>
        </div>

        {spotifyConnected ? (
          <div className="space-y-3">
            <p className="font-body text-xs text-muted-foreground">
              Connected{spotifyUsername ? <> as <span className="font-semibold text-primary">{spotifyUsername}</span></> : ""}
            </p>
            <Button size="sm" onClick={() => setSpotifyRecsOpen(true)} className="w-full bg-primary font-body text-xs font-semibold text-primary-foreground">
              <Sparkles size={14} className="mr-1" />
              See Recommended Records
            </Button>
            <Button size="sm" variant="outline" onClick={handleDisconnectSpotify} className="w-full border-border font-body text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
              <Unlink size={14} className="mr-1" />
              Disconnect Spotify
            </Button>
          </div>
        ) : (
          <div>
            <p className="mb-3 font-body text-xs text-muted-foreground">
              Connect your Spotify account so we can suggest records that match your taste in music.
            </p>
            <Button size="sm" onClick={handleConnectSpotify} disabled={spotifyConnecting} className="w-full bg-primary font-body text-xs font-semibold text-primary-foreground">
              <Music size={14} className={`mr-1 ${spotifyConnecting ? "animate-spin" : ""}`} />
              {spotifyConnecting ? "Connecting..." : "Connect Spotify Account"}
            </Button>
          </div>
        )}
      </div>

      {/* Menu items */}
      <div className="space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.label}
            className="flex w-full items-center gap-3 rounded-xl p-4 transition-colors hover:bg-card"
            onClick={() => {
              if (item.label === "Edit Profile") setEditProfileOpen(true);
              else if (item.label === "Transaction History") setTransactionHistoryOpen(true);
              else if (item.label === "Grading History") setGradingHistoryOpen(true);
              else if (item.label === "Notification Settings") setNotifSettingsOpen(true);
              else if (item.label === "Help & Support") setHelpSupportOpen(true);
              else if (item.label === "Settings") setSettingsOpen(true);
            }}
          >
            <item.icon size={18} className="text-muted-foreground" />
            <span className="flex-1 text-left font-body text-sm font-medium text-foreground">{item.label}</span>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        ))}
      </div>

      <div className="mt-8">
        <Button variant="outline" onClick={signOut} className="w-full border-border font-body text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
          <LogOut size={16} className="mr-2" />
          Sign Out
        </Button>
      </div>

      <UserCollectionSheet
        open={!!viewingUser}
        onOpenChange={(open) => !open && setViewingUser(null)}
        userId={viewingUser?.id || ""}
        userName={viewingUser?.name || ""}
      />

      <EditProfileSheet
        open={editProfileOpen}
        onOpenChange={(open) => {
          setEditProfileOpen(open);
          if (!open && user) {
            supabase.from("profiles").select("user_id, short_id, display_name, avatar_url, nickname, first_name, last_name").eq("user_id", user.id).single()
              .then(({ data }) => setMyProfile(data as ProfileRow | null));
          }
        }}
      />

      <TransactionHistorySheet
        open={transactionHistoryOpen}
        onOpenChange={setTransactionHistoryOpen}
      />

      <GradingHistorySheet
        open={gradingHistoryOpen}
        onOpenChange={setGradingHistoryOpen}
      />

      <NotificationSettingsSheet
        open={notifSettingsOpen}
        onOpenChange={setNotifSettingsOpen}
      />

      <HelpSupportSheet
        open={helpSupportOpen}
        onOpenChange={setHelpSupportOpen}
      />

      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    </div>
  );
};

export default ProfileScreen;
