import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface AdminUser {
  id: string;
  email: string;
  phone: string;
  display_name: string;
  created_at: string;
  roles: string[];
}

const callAdmin = async (action: string, body?: Record<string, unknown>) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin?action=${action}`;
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Admin request failed");
  return data;
};

export const useIsAdmin = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin");
      return (data && data.length > 0) || false;
    },
    enabled: !!user,
  });
};

export const useAdminUsers = () =>
  useQuery<AdminUser[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const data = await callAdmin("list_users");
      return data.users;
    },
  });

export const useUpdateRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { user_id: string; role: string; grant: boolean }) =>
      callAdmin("update_role", params),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
};

export const useUpdateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      user_id: string;
      email?: string;
      phone?: string;
      password?: string;
      display_name?: string;
    }) => callAdmin("update_user", params),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
};
