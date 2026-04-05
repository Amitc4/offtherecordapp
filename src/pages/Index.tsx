/**
 * @file Index.tsx — Root page component (route: `/`).
 *
 * Acts as an authentication gate:
 * - While auth state is loading → shows a centered spinner.
 * - If no user is signed in → renders `<LoginPage />`.
 * - If user is authenticated → renders `<HomePage />` (the main app shell with tabs).
 */
import LoginPage from "@/pages/LoginPage";
import HomePage from "@/pages/HomePage";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <HomePage />;
};

export default Index;
