import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/admin-bootstrap")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { email, password, full_name } = await request.json();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Try to create the user (auto-confirmed)
        let userId: string | null = null;
        const created = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name },
        });
        if (created.data?.user) {
          userId = created.data.user.id;
        } else {
          // Likely already exists — find by listing
          const list = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const found = list.data?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
          if (!found) {
            return new Response(
              JSON.stringify({ error: created.error?.message ?? "user not found" }),
              { status: 500, headers: { "content-type": "application/json" } },
            );
          }
          userId = found.id;
          // Reset password to requested one
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            password,
            email_confirm: true,
            user_metadata: { full_name },
          });
        }

        // Ensure profile exists
        await supabaseAdmin
          .from("profiles")
          .upsert({ id: userId, email, full_name }, { onConflict: "id" });

        // Ensure admin role
        await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });

        return new Response(JSON.stringify({ ok: true, userId }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
