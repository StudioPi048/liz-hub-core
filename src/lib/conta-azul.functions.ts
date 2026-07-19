import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getContaAzulAuthUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ origin: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId, "Apenas administradores podem conectar a Conta Azul.");

    const { requireContaAzulEnv, signContaAzulState, buildContaAzulAuthUrl } =
      await import("./conta-azul.server");
    const { stateSecret } = requireContaAzulEnv();
    const state = signContaAzulState(context.userId, data.origin, stateSecret);

    return { url: buildContaAzulAuthUrl(state) };
  });

export const getContaAzulStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const isAdmin = await getIsAdmin(context.userId);
    const { getContaAzulSafeStatus } = await import("./conta-azul.server");

    try {
      const status = await getContaAzulSafeStatus();
      return { ...status, isAdmin };
    } catch (error) {
      return {
        status: "setup_required" as const,
        reason: classifyContaAzulSetupError(error),
        isAdmin,
      };
    }
  });

export const disconnectContaAzul = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId, "Apenas administradores podem desconectar a Conta Azul.");

    const { disconnectContaAzulConnection } = await import("./conta-azul.server");
    await disconnectContaAzulConnection();

    return { ok: true };
  });

export const listContaAzulCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { listContaAzulCategorias } = await import("./conta-azul.server");
    return listContaAzulCategorias();
  });

async function requireAdmin(userId: string, message: string) {
  const isAdmin = await getIsAdmin(userId);
  if (!isAdmin) throw new Error(message);
}

async function getIsAdmin(userId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  return roles?.some((r) => r.role === "admin") || false;
}

function classifyContaAzulSetupError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/CONTA_AZUL|não configurada|not configured|Missing/i.test(message)) {
    return "missing_environment" as const;
  }
  if (/conta_azul_oauth_tokens|relation .* does not exist|schema cache/i.test(message)) {
    return "missing_database_migration" as const;
  }

  return "status_unavailable" as const;
}
