/**
 * @file App.tsx — Root application component.
 *
 * Sets up all top-level providers and routing:
 *
 * **Provider hierarchy (outer → inner):**
 * 1. `QueryClientProvider` – React Query cache for server-state management.
 * 2. `AuthProvider` – Supabase auth context (current user, session, sign-in/out helpers).
 * 3. `AccessibilityProvider` – Persisted a11y preferences (font size, contrast, etc.).
 * 4. `TooltipProvider` – shadcn tooltip context.
 *
 * **Routes:**
 * - `/`                – Main index page (login or home depending on auth state).
 * - `/discogs/callback` – OAuth callback after Discogs account linking.
 * - `*`                – 404 fallback.
 *
 * **Global UI overlays:**
 * - `<Toaster />` / `<Sonner />` – Toast notification renderers.
 * - `<AccessibilityMenu />` – Floating a11y + notifications button (always visible).
 */
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { AccessibilityProvider } from "@/hooks/useAccessibility";
import AccessibilityMenu from "@/components/AccessibilityMenu";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import DiscogsCallback from "./pages/DiscogsCallback";

/** Shared React Query client – used for caching API / Supabase data. */
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AccessibilityProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/discogs/callback" element={<DiscogsCallback />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          <AccessibilityMenu />
        </TooltipProvider>
      </AccessibilityProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
