/**
 * @file EditProfileSheet.tsx — Bottom sheet for editing the user's profile information.
 *
 * Editable fields: First Name, Last Name, Email, App Nickname, Phone Number, Password.
 *
 * - Profile fields are saved to the `profiles` table.
 * - Email changes trigger a confirmation email via `supabase.auth.updateUser`.
 * - Password changes require a minimum of 6 characters.
 * - The `display_name` is auto-computed from first + last name (or nickname fallback).
 */
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface EditProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EditProfileSheet = ({ open, onOpenChange }: EditProfileSheetProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    setNewPassword("");

    setEmail(user.email || "");

    supabase
      .from("profiles")
      .select("first_name, last_name, nickname, phone_number, display_name")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setFirstName(data.first_name || "");
          setLastName(data.last_name || "");
          setNickname((data as any).nickname || "");
          setPhoneNumber((data as any).phone_number || "");
        }
        setLoading(false);
      });
  }, [open, user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      // Update profile fields
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          nickname: nickname.trim() || null,
          phone_number: phoneNumber.trim() || null,
          display_name: [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") || nickname.trim() || null,
        } as any)
        .eq("user_id", user.id);

      if (profileError) throw profileError;

      // Update email if changed
      if (email.trim() && email.trim() !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email: email.trim() });
        if (emailError) throw emailError;
        toast.info("Confirmation email sent to your new address");
      }

      // Update password if provided
      if (newPassword.trim()) {
        if (newPassword.trim().length < 6) {
          toast.error("Password must be at least 6 characters");
          setSaving(false);
          return;
        }
        const { error: pwError } = await supabase.auth.updateUser({ password: newPassword.trim() });
        if (pwError) throw pwError;
      }

      toast.success("Profile updated!");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl p-0">
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="font-display text-lg">Edit Profile</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6 space-y-4" style={{ maxHeight: "calc(85vh - 120px)" }}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={28} className="animate-spin text-muted-foreground/40" />
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="font-body text-xs text-muted-foreground">First Name</Label>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  className="h-11 font-body text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-body text-xs text-muted-foreground">Last Name</Label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  className="h-11 font-body text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-body text-xs text-muted-foreground">Email Address</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="h-11 font-body text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-body text-xs text-muted-foreground">App Nickname</Label>
                <Input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Your nickname in the app"
                  className="h-11 font-body text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-body text-xs text-muted-foreground">Phone Number</Label>
                <Input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Phone number"
                  className="h-11 font-body text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-body text-xs text-muted-foreground">New Password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Leave blank to keep current"
                  className="h-11 font-body text-sm"
                />
              </div>

              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full mt-2 h-11 font-body text-sm font-semibold"
              >
                {saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
                Save Changes
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default EditProfileSheet;
