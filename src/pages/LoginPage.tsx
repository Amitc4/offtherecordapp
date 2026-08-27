/**
 * @file LoginPage.tsx — Sign-in / registration screen.
 *
 * Displays the "Off The Record" branding (spinning vinyl logo + tagline)
 * and a form that toggles between **Sign In** and **Register** modes.
 *
 * - **Sign In** – calls `signIn(email, password)` from `useAuth`.
 * - **Register** – calls `signUp(email, password, displayName)`.
 *   On success a confirmation-email toast is shown (email verification is required).
 *
 * The page uses Framer Motion for entrance animations.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import VinylLogo from "@/components/VinylLogo";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable";

/** Official Google "G" mark (4-color), per Google Sign-In branding guidelines. */
const GoogleIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
    <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>
    <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>
    <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"/>
    <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/>
  </svg>
);

/** Official monochrome Apple logo glyph, per Sign in with Apple HIG. */
const AppleIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg viewBox="0 0 814 1000" className={className} fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1-67.4 0-84.7-39.5-162.4-39.5-75.8 0-102.7 40.8-164.2 40.8-63.3 0-107.4-58-155.1-129.2C51.1 787.2 11.5 660 11.5 539.2c0-198.3 128.9-303.4 255.7-303.4 67.4 0 123.6 44.3 165.9 44.3 40.3 0 103.2-47 179.9-47 29.1 0 131.5 2.6 175.1 107.8zM554.1 159.4c31.7-37.6 54.1-89.8 54.1-142 0-7.2-.6-14.5-1.9-20.4-51.6 1.9-113 34.3-149.9 77.2-29.1 33.1-56.3 85.3-56.3 138.2 0 6.5.6 13 1.1 15.1 3.3.6 8.6 1.3 14 1.3 46.3 0 103.5-31 138.9-69.4z"/>
  </svg>
);

const LoginPage = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "apple" | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const { signIn, signUp } = useAuth();

  const handleResend = async () => {
    if (!pendingEmail) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: pendingEmail,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) toast.error(error.message);
      else toast.success("Confirmation email sent again.");
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegister) {
        const { error } = await signUp(email, password, displayName || undefined);
        if (error) {
          toast.error(error.message);
        } else {
          setPendingEmail(email);
          toast.success("Check your email to confirm your account!");
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) toast.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSocial = async (provider: "google" | "apple") => {
    setSocialLoading(provider);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message ?? `Could not sign in with ${provider}`);
        setSocialLoading(null);
        return;
      }
      // On redirect, browser navigates away — leave loading state.
    } catch (err: any) {
      toast.error(err?.message ?? `Could not sign in with ${provider}`);
      setSocialLoading(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="pointer-events-none fixed inset-0 opacity-[0.03]" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)`,
        backgroundSize: '24px 24px'
      }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 flex w-full max-w-sm flex-col items-center"
      >
        <div className="mb-8 rounded-full" style={{ width: 180, height: 180, boxShadow: '0 0 60px 20px hsl(30 90% 55% / 0.3), 0 0 120px 40px hsl(24 85% 50% / 0.15)' }}>
          <VinylLogo size={180} spinning />
        </div>

        <p className="mb-10 text-center font-body text-sm tracking-wide text-muted-foreground">
          Swap · Sell · Discover Vinyl
        </p>

        <motion.form
          onSubmit={handleSubmit}
          className="w-full space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          {isRegister && (
            <Input
              type="text"
              placeholder="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="h-12 rounded-lg border-border bg-card font-body text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
            />
          )}
          <Input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-12 rounded-lg border-border bg-card font-body text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="h-12 rounded-lg border-border bg-card font-body text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
          />

          <Button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-lg bg-primary font-body text-sm font-semibold tracking-wide text-primary-foreground hover:bg-accent"
          >
            <Mail className="mr-2 h-4 w-4" />
            {loading ? "Please wait..." : isRegister ? "Create Account" : "Sign In with Email"}
          </Button>
        </motion.form>

        <div className="mt-6 flex w-full items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="font-body text-xs uppercase tracking-wider text-muted-foreground">or continue with</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="mt-4 flex w-full flex-col gap-3">
          <Button
            type="button"
            disabled={socialLoading !== null || loading}
            onClick={() => handleSocial("apple")}
            className="h-12 w-full rounded-lg border border-black bg-black font-body text-sm font-semibold tracking-wide text-white hover:bg-black/90"
          >
            <AppleIcon className="mr-2 h-[18px] w-[18px] text-white" />
            {socialLoading === "apple" ? "Please wait..." : "Sign in with Apple"}
          </Button>
          <Button
            type="button"
            disabled={socialLoading !== null || loading}
            onClick={() => handleSocial("google")}
            className="h-12 w-full rounded-lg border border-border bg-white font-body text-sm font-semibold tracking-wide text-neutral-800 shadow-sm hover:bg-neutral-50"
          >
            <GoogleIcon />
            <span className="ml-2">{socialLoading === "google" ? "Please wait..." : "Sign in with Google"}</span>
          </Button>
        </div>

        <p className="mt-8 text-center font-body text-sm text-muted-foreground">
          {isRegister ? "Already have an account?" : "New to Off The Record?"}{" "}
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="font-semibold text-primary underline-offset-2 hover:underline"
          >
            {isRegister ? "Sign in" : "Register"}
          </button>
        </p>
      </motion.div>
    </div>
  );
};

export default LoginPage;
