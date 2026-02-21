import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = [
  "https://offtherecordapp.lovable.app",
  "https://id-preview--cb001185-69e1-4b05-b54d-b8f03a2f28aa.lovable.app",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check if user is admin or main_admin
    const { data: userRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "main_admin"]);

    const userRole = userRoles?.find((r: any) => r.role === "main_admin")?.role
      || userRoles?.find((r: any) => r.role === "admin")?.role;

    if (!userRole) {
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const isMainAdmin = userRole === "main_admin";

    const { action, ...params } = await req.json();

    // Validation helpers
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    switch (action) {
      case "list_users": {
        const { search } = params;
        const { data: { users }, error } = await adminClient.auth.admin.listUsers({
          perPage: 1000,
        });
        if (error) throw error;

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
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      case "update_user": {
        const { target_user_id, email, phone, password, display_name } = params;
        if (!target_user_id || !UUID_RE.test(target_user_id)) throw new Error("Valid target_user_id required");
        if (email && !EMAIL_RE.test(email)) throw new Error("Invalid email format");
        if (email && email.length > 255) throw new Error("Email too long");
        if (phone && (typeof phone !== "string" || phone.length > 20)) throw new Error("Invalid phone");
        if (password && (typeof password !== "string" || password.length < 8)) throw new Error("Password must be at least 8 characters");
        if (password && password.length > 128) throw new Error("Password too long");
        if (display_name !== undefined && typeof display_name === "string" && display_name.length > 100) throw new Error("Display name too long");

        const authUpdates: any = {};
        if (email) authUpdates.email = email;
        if (phone) authUpdates.phone = phone;
        if (password) authUpdates.password = password;

        if (Object.keys(authUpdates).length > 0) {
          const { error } = await adminClient.auth.admin.updateUserById(target_user_id, authUpdates);
          if (error) throw error;
        }

        if (display_name !== undefined) {
          const { error } = await adminClient
            .from("profiles")
            .update({ display_name })
            .eq("user_id", target_user_id);
          if (error) throw error;
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      case "set_role": {
        const { target_user_id, role } = params;
        if (!target_user_id || !UUID_RE.test(target_user_id)) throw new Error("Valid target_user_id required");
        if (!role || !["admin", "user"].includes(role)) throw new Error("Invalid role");

        // Only main_admin can directly set admin role; regular admins must submit a request
        if (role === "admin" && !isMainAdmin) {
          throw new Error("Only main admin can directly promote users. Use request_admin instead.");
        }

        // Prevent changing main_admin's role
        const { data: targetRoles } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", target_user_id);
        if (targetRoles?.some((r: any) => r.role === "main_admin")) {
          throw new Error("Cannot change main admin's role");
        }

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
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      case "request_admin": {
        const { target_user_id, target_email, target_display_name } = params;
        if (!target_user_id || !UUID_RE.test(target_user_id)) throw new Error("Valid target_user_id required");

        // Check if there's already a pending request
        const { data: existingReq } = await adminClient
          .from("admin_requests")
          .select("id")
          .eq("target_user_id", target_user_id)
          .eq("status", "pending")
          .maybeSingle();

        if (existingReq) throw new Error("A pending request already exists for this user");

        const { error } = await adminClient.from("admin_requests").insert({
          requester_id: user.id,
          target_user_id,
          target_email: target_email || "",
          target_display_name: target_display_name || "",
          requested_role: "admin",
        });
        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      case "list_requests": {
        if (!isMainAdmin) throw new Error("Only main admin can view requests");

        const { data: requests, error } = await adminClient
          .from("admin_requests")
          .select("*")
          .eq("status", "pending")
          .order("created_at", { ascending: false });
        if (error) throw error;

        return new Response(JSON.stringify({ requests: requests || [] }), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      case "review_request": {
        if (!isMainAdmin) throw new Error("Only main admin can review requests");

        const { request_id, decision } = params;
        if (!request_id || !UUID_RE.test(request_id)) throw new Error("Valid request_id required");
        if (!["approved", "rejected"].includes(decision)) throw new Error("Invalid decision");

        const { data: request, error: fetchErr } = await adminClient
          .from("admin_requests")
          .select("*")
          .eq("id", request_id)
          .eq("status", "pending")
          .maybeSingle();
        if (fetchErr) throw fetchErr;
        if (!request) throw new Error("Request not found or already reviewed");

        // Update request status
        const { error: updateErr } = await adminClient
          .from("admin_requests")
          .update({ status: decision, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
          .eq("id", request_id);
        if (updateErr) throw updateErr;

        // If approved, set the user's role to admin
        if (decision === "approved") {
          const { data: existing } = await adminClient
            .from("user_roles")
            .select("id")
            .eq("user_id", request.target_user_id)
            .maybeSingle();

          if (existing) {
            await adminClient.from("user_roles").update({ role: "admin" }).eq("user_id", request.target_user_id);
          } else {
            await adminClient.from("user_roles").insert({ user_id: request.target_user_id, role: "admin" });
          }
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      case "get_my_role": {
        return new Response(JSON.stringify({ role: userRole, is_main_admin: isMainAdmin }), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
