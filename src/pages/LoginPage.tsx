import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import VinylLogo from "@/components/VinylLogo";

const LoginPage = ({ onLogin }: { onLogin: () => void }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      {/* Subtle background texture */}
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
        {/* Logo */}
        <div className="mb-8 rounded-full" style={{ width: 180, height: 180, boxShadow: '0 0 60px 20px hsl(30 90% 55% / 0.3), 0 0 120px 40px hsl(24 85% 50% / 0.15)' }}>
          <VinylLogo size={180} spinning />
        </div>

        {/* Tagline */}
        <p className="mb-10 text-center font-body text-sm tracking-wide text-muted-foreground">
          Swap · Sell · Discover Vinyl
        </p>

        {/* Auth form */}
        <motion.form
          onSubmit={handleSubmit}
          className="w-full space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          <Input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-lg border-border bg-card font-body text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 rounded-lg border-border bg-card font-body text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
          />

          <Button
            type="submit"
            className="h-12 w-full rounded-lg bg-primary font-body text-sm font-semibold tracking-wide text-primary-foreground hover:bg-accent"
          >
            <Mail className="mr-2 h-4 w-4" />
            {isRegister ? "Create Account" : "Sign In with Email"}
          </Button>
        </motion.form>

        {/* Divider */}
        <div className="my-6 flex w-full items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="font-body text-xs text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Spotify */}
        <Button
          variant="outline"
          onClick={onLogin}
          className="h-12 w-full rounded-lg border-border bg-card font-body text-sm font-medium text-foreground hover:bg-secondary"
        >
          <Music className="mr-2 h-4 w-4 text-primary" />
          Continue with Spotify
        </Button>

        {/* Toggle register / login */}
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
