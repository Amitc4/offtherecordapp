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
import { Bell, Volume2, Vibrate, Clock, MessageSquare, Heart, Package, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface NotificationSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface NotificationPrefs {
  sound: boolean;
  vibrate: boolean;
  batchMode: "immediate" | "daily";
  tradeOffers: boolean;
  wishlistMatches: boolean;
  friendRequests: boolean;
  chatMessages: boolean;
}

const STORAGE_KEY = "vinyl_notification_prefs";

const defaultPrefs: NotificationPrefs = {
  sound: true,
  vibrate: true,
  batchMode: "immediate",
  tradeOffers: true,
  wishlistMatches: true,
  friendRequests: true,
  chatMessages: true,
};

const loadPrefs = (): NotificationPrefs => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultPrefs, ...JSON.parse(raw) };
  } catch {}
  return defaultPrefs;
};

const NotificationSettingsSheet = ({ open, onOpenChange }: NotificationSettingsSheetProps) => {
  const [prefs, setPrefs] = useState<NotificationPrefs>(defaultPrefs);

  useEffect(() => {
    if (open) setPrefs(loadPrefs());
  }, [open]);

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
