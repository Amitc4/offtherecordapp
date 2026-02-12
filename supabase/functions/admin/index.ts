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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the calling user is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: callingUser },
    } = await anonClient.auth.getUser();
    if (!callingUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callingUser.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // LIST USERS
    if (action === "list_users") {
      const { data, error } = await serviceClient.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (error) throw error;

      // Get all roles
      const { data: allRoles } = await serviceClient
        .from("user_roles")
        .select("user_id, role");

      // Get all profiles
      const { data: allProfiles } = await serviceClient
        .from("profiles")
        .select("user_id, display_name, avatar_url");

      const users = data.users.map((u) => ({
        id: u.id,
        email: u.email,
        phone: u.phone || "",
        display_name:
          allProfiles?.find((p) => p.user_id === u.id)?.display_name ||
          u.user_metadata?.display_name ||
          "",
        created_at: u.created_at,
        roles: allRoles
          ?.filter((r) => r.user_id === u.id)
          .map((r) => r.role) || [],
      }));

      return new Response(JSON.stringify({ users }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // UPDATE USER ROLE
    if (action === "update_role" && req.method === "POST") {
      const { user_id, role, grant } = await req.json();
      if (!user_id || !role) throw new Error("user_id and role required");

      if (grant) {
        const { error } = await serviceClient
          .from("user_roles")
          .upsert({ user_id, role }, { onConflict: "user_id,role" });
        if (error) throw error;
      } else {
        const { error } = await serviceClient
          .from("user_roles")
          .delete()
          .eq("user_id", user_id)
          .eq("role", role);
        if (error) throw error;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // UPDATE USER INFO
    if (action === "update_user" && req.method === "POST") {
      const { user_id, email, phone, password, display_name } =
        await req.json();
      if (!user_id) throw new Error("user_id required");

      // Update auth user (email, phone, password)
      const authUpdates: Record<string, unknown> = {};
      if (email) authUpdates.email = email;
      if (phone) authUpdates.phone = phone;
      if (password) authUpdates.password = password;

      if (Object.keys(authUpdates).length > 0) {
        const { error } = await serviceClient.auth.admin.updateUserById(
          user_id,
          authUpdates
        );
        if (error) throw error;
      }

      // Update profile display name
      if (display_name !== undefined) {
        const { error } = await serviceClient
          .from("profiles")
          .update({ display_name })
          .eq("user_id", user_id);
        if (error) throw error;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
