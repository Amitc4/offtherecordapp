/**
 * @file NotificationSettingsSheet.tsx — User notification preferences.
 *
 * Settings are stored in localStorage (device-specific). Options include:
 * - Sound on/off
 * - Vibration on/off
 * - Batch notifications (immediate vs end-of-day digest)
 * - Per-type toggles (trade offers, wishlist matches, friend requests, chat messages)
 */
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Bell, Volume2, Vibrate, Clock, MessageSquare, Heart, Package, UserPlus, BellRing } from "lucide-react";
import { toast } from "sonner";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { usePushPreferences } from "@/hooks/usePushPreferences";

/** Props for the Notification Settings bottom-sheet. */
interface NotificationSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Persisted notification preferences. Stored as JSON in localStorage
 * under {@link STORAGE_KEY}; not synced across devices by design.
 */
interface NotificationPrefs {
  sound: boolean;
  vibrate: boolean;
  /** "immediate" pushes per event, "daily" batches into an end-of-day digest. */
  batchMode: "immediate" | "daily";
  tradeOffers: boolean;
  wishlistMatches: boolean;
  friendRequests: boolean;
  chatMessages: boolean;
}

/** localStorage key for persisted prefs (device-specific). */
const STORAGE_KEY = "vinyl_notification_prefs";

/** Default prefs applied on first run / when stored value is missing or invalid. */
const defaultPrefs: NotificationPrefs = {
  sound: true,
  vibrate: true,
  batchMode: "immediate",
  tradeOffers: true,
  wishlistMatches: true,
  friendRequests: true,
  chatMessages: true,
};

/** Read prefs from localStorage; returns {@link defaultPrefs} on miss/parse error. */
const loadPrefs = (): NotificationPrefs => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultPrefs, ...JSON.parse(raw) };
  } catch {}
  return defaultPrefs;
};

const NotificationSettingsSheet = ({ open, onOpenChange }: NotificationSettingsSheetProps) => {
  const [prefs, setPrefs] = useState<NotificationPrefs>(defaultPrefs);
  const push = usePushNotifications();
  const pushPrefs = usePushPreferences();

  /** Master switch: subscribe/unsubscribe this device and store the account-level choice. */
  const togglePush = async (v: boolean) => {
    const res = v ? await push.subscribe() : await push.unsubscribe();
    if (!res.ok) {
      toast.error(res.error ?? "Couldn't change push notifications");
      return;
    }
    const saved = await pushPrefs.update({ push_enabled: v });
    if (!saved.ok) {
      toast.error(saved.error ?? "Couldn't save your push preference");
      return;
    }
    toast.success(v ? "Push notifications enabled" : "Push notifications turned off");
  };

  /** Per-type push opt-in (applies to all your devices). */
  const togglePushType = async (key: "chat_message" | "friend_request" | "wishlist_match", v: boolean) => {
    const res = await pushPrefs.update({ [key]: v });
    if (!res.ok) toast.error(res.error ?? "Couldn't save your push preference");
  };

  const pushOn = push.enabled && pushPrefs.prefs.push_enabled;


  useEffect(() => {
    if (open) setPrefs(loadPrefs());
  }, [open]);

  /** Merge a partial change into prefs and persist immediately. */
  const update = (patch: Partial<NotificationPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    toast.success("Notification settings saved");
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="font-display flex items-center gap-2">
            <Bell size={20} className="text-primary" />
            Notification Settings
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6 overflow-y-auto max-h-[65vh] pr-1">
          {/* General */}
          <div>
            <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              General
            </h3>
            <div className="space-y-1">
              <div className="flex items-center gap-3 rounded-xl p-4 hover:bg-card transition-colors">
                <BellRing size={18} className="text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm font-medium text-foreground">Push Notifications</p>
                  <p className="font-body text-xs text-muted-foreground">
                    {push.supported
                      ? "Get alerts on this device even when the app is closed"
                      : "Not supported on this device — install the app to your home screen"}
                  </p>
                </div>
                <Switch
                  checked={pushOn}
                  disabled={!push.supported || push.loading || pushPrefs.loading}
                  onCheckedChange={togglePush}
                />
              </div>

              {pushOn && (
                <div className="ml-4 space-y-1 border-l-2 border-primary/20 pl-2">
                  <p className="font-body text-xs text-muted-foreground px-2 pt-2">
                    Choose what you get pushed to your phone
                  </p>
                  <SettingRow
                    icon={MessageSquare}
                    label="Chat Messages"
                    description="Push me when someone sends a message"
                    checked={pushPrefs.prefs.chat_message}
                    onChange={(v) => togglePushType("chat_message", v)}
                  />
                  <SettingRow
                    icon={UserPlus}
                    label="Friend Requests"
                    description="Push me when someone adds me as a friend"
                    checked={pushPrefs.prefs.friend_request}
                    onChange={(v) => togglePushType("friend_request", v)}
                  />
                  <SettingRow
                    icon={Heart}
                    label="Wishlist Matches"
                    description="Push me when a wanted record is listed"
                    checked={pushPrefs.prefs.wishlist_match}
                    onChange={(v) => togglePushType("wishlist_match", v)}
                  />
                </div>
              )}
              <SettingRow
                icon={Volume2}
                label="Sound"
                description="Play a sound for new notifications"
                checked={prefs.sound}
                onChange={(v) => update({ sound: v })}
              />
              <SettingRow
                icon={Vibrate}
                label="Vibration"
                description="Vibrate on new notifications"
                checked={prefs.vibrate}
                onChange={(v) => update({ vibrate: v })}
              />
            </div>
          </div>

          {/* Delivery */}
          <div>
            <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Delivery
            </h3>
            <div className="space-y-1">
              <button
                onClick={() => update({ batchMode: "immediate" })}
                className={`flex w-full items-center gap-3 rounded-xl p-4 transition-colors ${
                  prefs.batchMode === "immediate" ? "bg-primary/10" : "hover:bg-card"
                }`}
              >
                <Bell size={18} className={prefs.batchMode === "immediate" ? "text-primary" : "text-muted-foreground"} />
                <div className="flex-1 text-left">
                  <p className="font-body text-sm font-medium text-foreground">Immediate</p>
                  <p className="font-body text-xs text-muted-foreground">Get notified as things happen</p>
                </div>
                <div className={`h-4 w-4 rounded-full border-2 ${
                  prefs.batchMode === "immediate" ? "border-primary bg-primary" : "border-muted-foreground"
                }`} />
              </button>
              <button
                onClick={() => update({ batchMode: "daily" })}
                className={`flex w-full items-center gap-3 rounded-xl p-4 transition-colors ${
                  prefs.batchMode === "daily" ? "bg-primary/10" : "hover:bg-card"
                }`}
              >
                <Clock size={18} className={prefs.batchMode === "daily" ? "text-primary" : "text-muted-foreground"} />
                <div className="flex-1 text-left">
                  <p className="font-body text-sm font-medium text-foreground">Daily Digest</p>
                  <p className="font-body text-xs text-muted-foreground">Batch all notifications at end of day</p>
                </div>
                <div className={`h-4 w-4 rounded-full border-2 ${
                  prefs.batchMode === "daily" ? "border-primary bg-primary" : "border-muted-foreground"
                }`} />
              </button>
            </div>
          </div>

          {/* Notification Types */}
          <div>
            <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Notification Types
            </h3>
            <div className="space-y-1">
              <SettingRow
                icon={Package}
                label="Trade Offers"
                description="New offers, updates, and confirmations"
                checked={prefs.tradeOffers}
                onChange={(v) => update({ tradeOffers: v })}
              />
              <SettingRow
                icon={Heart}
                label="Wishlist Matches"
                description="When a wanted record becomes available"
                checked={prefs.wishlistMatches}
                onChange={(v) => update({ wishlistMatches: v })}
              />
              <SettingRow
                icon={UserPlus}
                label="Friend Requests"
                description="New friend requests and acceptances"
                checked={prefs.friendRequests}
                onChange={(v) => update({ friendRequests: v })}
              />
              <SettingRow
                icon={MessageSquare}
                label="Chat Messages"
                description="New messages in your conversations"
                checked={prefs.chatMessages}
                onChange={(v) => update({ chatMessages: v })}
              />
            </div>
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={handleSave}
            className="w-full rounded-xl bg-primary py-3 font-body text-sm font-semibold text-primary-foreground"
          >
            Save Settings
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

/** Reusable row with icon, label, description, and a toggle switch. */
const SettingRow = ({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <div className="flex items-center gap-3 rounded-xl p-4 hover:bg-card transition-colors">
    <Icon size={18} className="text-muted-foreground shrink-0" />
    <div className="flex-1 min-w-0">
      <p className="font-body text-sm font-medium text-foreground">{label}</p>
      <p className="font-body text-xs text-muted-foreground">{description}</p>
    </div>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

export default NotificationSettingsSheet;
