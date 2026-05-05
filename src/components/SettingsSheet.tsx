/**
 * @file SettingsSheet.tsx — App settings panel.
 *
 * Includes:
 * - Dark/Light/System theme toggle
 * - Change password
 * - Clear local cache
 * - Delete account (with confirmation)
 * - App version info
 */
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Settings, Sun, Moon, Monitor, Lock, Trash2, Database, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/** Props for the Settings bottom-sheet. */
interface SettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Theme preference; "system" follows the OS color-scheme media query. */
type Theme = "light" | "dark" | "system";

const SettingsSheet = ({ open, onOpenChange }: SettingsSheetProps) => {
  const { user, signOut } = useAuth();
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("theme") as Theme) || "system";
  });
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  /**
   * Apply and persist a theme. For "system", reads `prefers-color-scheme`
   * once at apply-time (does not subscribe to changes).
   */
  const applyTheme = (t: Theme) => {
    setTheme(t);
    localStorage.setItem("theme", t);
    const root = document.documentElement;
    if (t === "dark") {
      root.classList.add("dark");
    } else if (t === "light") {
      root.classList.remove("dark");
    } else {
      // System preference
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
    toast.success(`Theme set to ${t}`);
  };

  /** Update the user's auth password. Requires an active session. */
  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated successfully");
      setNewPassword("");
      setConfirmPassword("");
      setShowChangePassword(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update password");
    } finally {
      setChangingPassword(false);
    }
  };

  /**
   * Wipe non-auth localStorage entries (notification prefs, theme cache, etc.).
   * The Supabase auth token is preserved so the user stays signed in.
   */
  const handleClearCache = () => {
    const keysToKeep = ["sb-zdfsqhrfnkdwtyipfisb-auth-token"];
    const allKeys = Object.keys(localStorage);
    allKeys.forEach((key) => {
      if (!keysToKeep.some((k) => key.startsWith(k))) {
        localStorage.removeItem(key);
      }
    });
    toast.success("Local cache cleared");
  };

  /**
   * Submit a deletion request and sign the user out. True account deletion
   * happens server-side once an admin processes the inquiry (requires
   * service-role privileges that the client doesn't have).
   */
  const handleDeleteAccount = async () => {
    // Note: Full account deletion requires admin/edge function.
    // For now, we deactivate by signing out and notifying admin.
    toast.info("Account deletion request submitted. You will be signed out.");
    if (user) {
      await supabase.from("support_inquiries").insert({
        user_id: user.id,
        subject: "Account Deletion Request",
        message: `User ${user.email} has requested account deletion.`,
      });
    }
    await signOut();
    onOpenChange(false);
  };

  const themes: { value: Theme; icon: React.ElementType; label: string }[] = [
    { value: "light", icon: Sun, label: "Light" },
    { value: "dark", icon: Moon, label: "Dark" },
    { value: "system", icon: Monitor, label: "System" },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="font-display flex items-center gap-2">
            <Settings size={20} className="text-primary" />
            Settings
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6 overflow-y-auto max-h-[65vh] pr-1">
          {/* Theme */}
          <div>
            <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Appearance
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {themes.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.value}
                    onClick={() => applyTheme(t.value)}
                    className={`flex flex-col items-center gap-2 rounded-xl p-4 transition-colors ${
                      theme === t.value ? "bg-primary/10 ring-2 ring-primary" : "bg-card"
                    }`}
                  >
                    <Icon size={22} className={theme === t.value ? "text-primary" : "text-muted-foreground"} />
                    <span className={`font-body text-xs font-medium ${theme === t.value ? "text-primary" : "text-foreground"}`}>
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Change Password */}
          <div>
            <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Security
            </h3>
            {!showChangePassword ? (
              <button
                onClick={() => setShowChangePassword(true)}
                className="flex w-full items-center gap-3 rounded-xl p-4 bg-card hover:bg-card/80 transition-colors"
              >
                <Lock size={18} className="text-muted-foreground" />
                <span className="flex-1 text-left font-body text-sm font-medium text-foreground">Change Password</span>
              </button>
            ) : (
              <div className="space-y-3 rounded-xl bg-card p-4">
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min 6 chars)"
                  className="font-body text-sm"
                />
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="font-body text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowChangePassword(false); setNewPassword(""); setConfirmPassword(""); }}
                    className="flex-1 rounded-lg py-2 font-body text-sm text-muted-foreground hover:bg-background"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleChangePassword}
                    disabled={changingPassword}
                    className="flex-1 rounded-lg bg-primary py-2 font-body text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {changingPassword ? "Updating..." : "Update"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Data */}
          <div>
            <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Data
            </h3>
            <button
              onClick={handleClearCache}
              className="flex w-full items-center gap-3 rounded-xl p-4 bg-card hover:bg-card/80 transition-colors"
            >
              <Database size={18} className="text-muted-foreground" />
              <div className="flex-1 text-left">
                <p className="font-body text-sm font-medium text-foreground">Clear Local Cache</p>
                <p className="font-body text-xs text-muted-foreground">Remove cached data from this device</p>
              </div>
            </button>
          </div>

          {/* Danger Zone */}
          <div>
            <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-destructive mb-3">
              Danger Zone
            </h3>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex w-full items-center gap-3 rounded-xl p-4 bg-destructive/5 hover:bg-destructive/10 transition-colors"
              >
                <Trash2 size={18} className="text-destructive" />
                <div className="flex-1 text-left">
                  <p className="font-body text-sm font-medium text-destructive">Delete Account</p>
                  <p className="font-body text-xs text-muted-foreground">Permanently delete your account and data</p>
                </div>
              </button>
            ) : (
              <div className="rounded-xl bg-destructive/5 p-4 space-y-3">
                <p className="font-body text-sm text-foreground">
                  Are you sure? This action cannot be undone. All your records, trades, and data will be permanently deleted.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 rounded-lg py-2 font-body text-sm text-muted-foreground hover:bg-background"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    className="flex-1 rounded-lg bg-destructive py-2 font-body text-sm font-semibold text-destructive-foreground"
                  >
                    Delete My Account
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* App Info */}
          <div className="flex items-center gap-2 justify-center py-4">
            <Info size={14} className="text-muted-foreground" />
            <span className="font-body text-xs text-muted-foreground">Off The Record v1.0.0</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SettingsSheet;
