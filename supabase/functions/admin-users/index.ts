import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the calling user is an admin using their JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...params } = await req.json();

    switch (action) {
      case "list_users": {
        const { search } = params;
        // List all auth users via admin API
        const { data: { users }, error } = await adminClient.auth.admin.listUsers({
          perPage: 1000,
        });
        if (error) throw error;

        // Get all profiles and roles
        const { data: profiles } = await adminClient.from("profiles").select("*");
        const { data: roles } = await adminClient.from("user_roles").select("*");

        const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
        const roleMap = new Map((roles || []).map((r: any) => [r.user_id, r.role]));

        let result = users.map((u: any) => {
          const profile = profileMap.get(u.id);
          return {
            id: u.id,
            email: u.email || "",
            phone: u.phone || "",
            display_name: profile?.display_name || "",
            avatar_url: profile?.avatar_url || "",
            role: roleMap.get(u.id) || "user",
            created_at: u.created_at,
          };
        });

        if (search) {
          const s = search.toLowerCase();
          result = result.filter(
            (u: any) =>
              u.email.toLowerCase().includes(s) ||
              u.display_name.toLowerCase().includes(s) ||
              u.phone.toLowerCase().includes(s)
          );
        }

        return new Response(JSON.stringify({ users: result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update_user": {
        const { target_user_id, email, phone, password, display_name } = params;
        if (!target_user_id) throw new Error("target_user_id required");

        // Update auth fields
        const authUpdates: any = {};
        if (email) authUpdates.email = email;
        if (phone) authUpdates.phone = phone;
        if (password) authUpdates.password = password;

        if (Object.keys(authUpdates).length > 0) {
          const { error } = await adminClient.auth.admin.updateUserById(target_user_id, authUpdates);
          if (error) throw error;
        }

        // Update profile display name
        if (display_name !== undefined) {
          const { error } = await adminClient
            .from("profiles")
            .update({ display_name })
            .eq("user_id", target_user_id);
          if (error) throw error;
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "set_role": {
        const { target_user_id, role } = params;
        if (!target_user_id || !role) throw new Error("target_user_id and role required");
        if (!["admin", "user"].includes(role)) throw new Error("Invalid role");

        // Upsert role
        const { data: existing } = await adminClient
          .from("user_roles")
          .select("id")
          .eq("user_id", target_user_id)
          .maybeSingle();

        if (existing) {
          const { error } = await adminClient
            .from("user_roles")
            .update({ role })
            .eq("user_id", target_user_id);
          if (error) throw error;
        } else {
          const { error } = await adminClient
            .from("user_roles")
            .insert({ user_id: target_user_id, role });
          if (error) throw error;
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
