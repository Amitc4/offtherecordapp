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
import { Mail, Music, Apple } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import VinylLogo from "@/components/VinylLogo";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
    <path fill="#EA4335" d="M12 10.2v3.9h5.45c-.24 1.4-1.7 4.1-5.45 4.1-3.28 0-5.95-2.72-5.95-6.07S8.72 6.06 12 6.06c1.87 0 3.12.8 3.84 1.48l2.62-2.52C16.82 3.55 14.62 2.6 12 2.6 6.84 2.6 2.66 6.78 2.66 12s4.18 9.4 9.34 9.4c5.39 0 8.96-3.79 8.96-9.12 0-.61-.07-1.08-.15-1.55H12z"/>
  </svg>
);

const LoginPage = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "apple" | null>(null);
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegister) {
        const { error } = await signUp(email, password, displayName || undefined);
        if (error) {
          toast.error(error.message);
        } else {
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
