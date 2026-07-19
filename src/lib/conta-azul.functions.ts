import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type {
  ContaAPagarRow,
  ContaAzulBackofficeModule,
  ContaAzulJsonRecord,
  ContaAzulJsonValue,
  ContaAzulOperationResult,
} from "./conta-azul.server";

export const getContaAzulAuthUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ origin: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const { requireContaAzulEnv, signContaAzulState, buildContaAzulAuthUrl } =
      await import("./conta-azul.server");

    try {
      await requireAdmin(context.userId, "Apenas administradores podem conectar a Conta Azul.");
      const { stateSecret } = requireContaAzulEnv();
      const state = signContaAzulState(context.userId, data.origin, stateSecret);

      return { ok: true as const, url: buildContaAzulAuthUrl(state) };
    } catch (error) {
      return {
        ok: false as const,
        reason: classifyContaAzulSetupError(error),
        message: errorMessage(error),
      };
    }
  });

type JsonValue = ContaAzulJsonValue;

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(jsonValueSchema),
  ]),
);

const jsonRecordSchema = z.record(jsonValueSchema);

export type ContaAzulStatusResult = {
  status: string;
  isAdmin: boolean;
  reason?: string;
  connectedAt?: string | null;
  connectedBy?: string | null;
  identity?: JsonValue | null;
  tokenExpiresAt?: string | null;
  lastError?: string | null;
};

export const getContaAzulStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ContaAzulStatusResult> => {
    const isAdmin = await getIsAdmin(context.userId);
    const { getContaAzulSafeStatus, requireContaAzulEnv } = await import("./conta-azul.server");

    try {
      requireContaAzulEnv();
      const status = await getContaAzulSafeStatus();
      return JSON.parse(JSON.stringify({ ...status, isAdmin })) as ContaAzulStatusResult;
    } catch (error) {
      return {
        status: "setup_required",
        reason: classifyContaAzulSetupError(error),
        isAdmin,
      };
    }
  });

export const getContaAzulBackofficeCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<ContaAzulBackofficeModule[]> => {
    const { getContaAzulBackofficeModules } = await import("./conta-azul.server");
    return getContaAzulBackofficeModules();
  });

export const disconnectContaAzul = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId, "Apenas administradores podem desconectar a Conta Azul.");

    const { disconnectContaAzulConnection } = await import("./conta-azul.server");
    await disconnectContaAzulConnection();

    return { ok: true };
  });

export type ContaAzulCategoriesResult = {
  needsAuth: boolean;
  status: string;
  categorias: JsonValue[];
  responseShape?: string | null;
  listSource?: string | null;
};

export const listContaAzulCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<ContaAzulCategoriesResult> => {
    const { listContaAzulCategorias } = await import("./conta-azul.server");
    const result = await listContaAzulCategorias();
    return JSON.parse(JSON.stringify(result)) as ContaAzulCategoriesResult;
  });

export type ContasAPagarResult = {
  ok: boolean;
  message?: string;
  contas: ContaAPagarRow[];
};

// Leitura amigavel de contas a pagar (GET). Janela: 12 meses atras ate o fim do
// mes atual, para trazer vencidas + as do mes numa chamada so.
export const getContasAPagar = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<ContasAPagarResult> => {
    const { runContaAzulOperation, normalizeContaAPagar } = await import("./conta-azul.server");

    const hoje = new Date();
    const de = new Date(hoje.getFullYear() - 1, hoje.getMonth(), 1);
    const ate = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    try {
      const result = await runContaAzulOperation({
        moduleId: "financeiro",
        actionId: "search-payables",
        query: {
          pagina: 1,
          tamanho_pagina: 200,
          data_vencimento_de: fmt(de),
          data_vencimento_ate: fmt(ate),
        },
      });

      const contas = result.items
        .filter(
          (item): item is ContaAzulJsonRecord =>
            Boolean(item) && typeof item === "object" && !Array.isArray(item),
        )
        .map((item) => normalizeContaAPagar(item));

      return { ok: true, contas };
    } catch (error) {
      return { ok: false, message: errorMessage(error), contas: [] };
    }
  });

export const executeContaAzulOperation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        moduleId: z.string().min(1),
        actionId: z.string().min(1),
        id: z.string().optional(),
        query: jsonRecordSchema.optional(),
        body: jsonValueSchema.optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<ContaAzulOperationResult> => {
    const { getContaAzulBackofficeModules, runContaAzulOperation } =
      await import("./conta-azul.server");
    const modules = getContaAzulBackofficeModules();
    const action = modules
      .find((module) => module.id === data.moduleId)
      ?.actions.find((candidate) => candidate.id === data.actionId);

    if (!action) throw new Error("Operação da Conta Azul inválida.");
    if (action.method !== "GET" || action.dangerous) {
      await requireAdmin(
        context.userId,
        "Apenas administradores podem executar operações de escrita na Conta Azul.",
      );
    }

    return runContaAzulOperation({
      moduleId: data.moduleId,
      actionId: data.actionId,
      id: data.id,
      query: data.query as ContaAzulJsonRecord | undefined,
      body: data.body,
    });
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
  const message = errorMessage(error);
  if (/administradores|admin/i.test(message)) {
    return "not_admin" as const;
  }
  if (/CONTA_AZUL|não configurada|not configured|Missing/i.test(message)) {
    return "missing_environment" as const;
  }
  if (/conta_azul_oauth_tokens|relation .* does not exist|schema cache/i.test(message)) {
    return "missing_database_migration" as const;
  }

  return "status_unavailable" as const;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }

  return "Erro ao iniciar OAuth da Conta Azul.";
}
