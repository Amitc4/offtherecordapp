import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import VinylLogo from "@/components/VinylLogo";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const LoginPage = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
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
