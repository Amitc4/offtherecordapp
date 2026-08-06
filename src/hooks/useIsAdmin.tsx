/**
 * @file useIsAdmin.tsx — Reports whether the signed-in user holds an admin role.
 *
 * Roles live in the `user_roles` table (never on the profile) and are read with
 * RLS enforced. Used to unlock admin-only affordances such as picking grading
 * photos from the photo library instead of capturing them live.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useIsAdmin = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "main_admin"])
      .then(({ data }) => {
        if (cancelled) return;
        setIsAdmin(!!(data && data.length > 0));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { isAdmin, loading };
};
