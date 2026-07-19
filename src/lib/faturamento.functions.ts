import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FatParcela } from "./faturamento.server";

export type ParcelaRow = FatParcela & { id: number };

export type FaturamentoResumo = {
  aReceberMes: { total: number; quantidade: number };
  recebidoMes: { total: number; quantidade: number };
  emAtraso: { total: number; quantidade: number };
  importadoEm: string | null;
  parcelasCount: number | null;
};

async function untypedDb(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Tabelas fat_* ainda nao estao nos types gerados do Supabase.
  return supabaseAdmin as unknown as SupabaseClient;
}

function monthRange(now = new Date()): { from: string; to: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: fmt(new Date(y, m, 1)), to: fmt(new Date(y, m + 1, 0)) };
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function somar(rows: { valor_liquido: number | null; valor_parcela: number | null }[]) {
  let total = 0;
  for (const r of rows) total += r.valor_liquido ?? r.valor_parcela ?? 0;
  return { total, quantidade: rows.length };
}

export const importarFaturamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { runFaturamentoImport } = await import("./faturamento.server");
    try {
      const counts = await runFaturamentoImport(context.userId);
      return { ok: true as const, counts };
    } catch (error) {
      return {
        ok: false as const,
        message: error instanceof Error ? error.message : "Erro desconhecido na importação.",
      };
    }
  });

export const getFaturamentoResumo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<FaturamentoResumo> => {
    const db = await untypedDb();
    const { from, to } = monthRange();
    const hoje = todayISO();
    const cols = "valor_liquido, valor_parcela";

    const [aberto, recebido, atrasado, status] = await Promise.all([
      db
        .from("fat_parcelas")
        .select(cols)
        .eq("status", "aberto")
        .gte("vcto", from)
        .lte("vcto", to)
        .range(0, 19999),
      db
        .from("fat_parcelas")
        .select("valor_recebido, valor_liquido, valor_parcela")
        .gte("dt_recebimento", from)
        .lte("dt_recebimento", to)
        .range(0, 19999),
      db.from("fat_parcelas").select(cols).eq("status", "aberto").lt("vcto", hoje).range(0, 19999),
      db
        .from("fat_import_status")
        .select("imported_at, parcelas_count")
        .eq("id", "system")
        .maybeSingle(),
    ]);

    const recebidoRows = (recebido.data ?? []) as {
      valor_recebido: number | null;
      valor_liquido: number | null;
      valor_parcela: number | null;
    }[];
    let recebidoTotal = 0;
    for (const r of recebidoRows)
      recebidoTotal += r.valor_recebido ?? r.valor_liquido ?? r.valor_parcela ?? 0;

    return {
      aReceberMes: somar((aberto.data ?? []) as ParcelaRow[]),
      recebidoMes: { total: recebidoTotal, quantidade: recebidoRows.length },
      emAtraso: somar((atrasado.data ?? []) as ParcelaRow[]),
      importadoEm: status.data?.imported_at ?? null,
      parcelasCount: status.data?.parcelas_count ?? null,
    };
  });

export type AlunoResumo = {
  cpf: string;
  nome: string;
  email: string | null;
  fone: string | null;
  cidade_uf: string | null;
  parcelas_atrasadas: number;
  valor_em_aberto: number;
  total_pago: number;
  ultima_compra: string | null;
  cursos: string[];
};

export const getAlunos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ alunos: AlunoResumo[] }> => {
    const db = await untypedDb();
    const { data, error } = await db
      .from("fat_alunos_resumo")
      .select("*")
      .order("nome")
      .range(0, 4999);
    if (error) throw new Error(error.message);
    return { alunos: (data ?? []) as AlunoResumo[] };
  });

const parcelasInput = z.object({
  escopo: z.enum(["mes", "atrasadas", "busca"]),
  busca: z.string().optional(),
});

export const getFaturamentoParcelas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => parcelasInput.parse(d))
  .handler(async ({ data }): Promise<{ parcelas: ParcelaRow[] }> => {
    const db = await untypedDb();
    const hoje = todayISO();

    let q = db.from("fat_parcelas").select("*");

    if (data.escopo === "mes") {
      const { from, to } = monthRange();
      q = q.eq("status", "aberto").gte("vcto", from).lte("vcto", to).order("vcto");
    } else if (data.escopo === "atrasadas") {
      q = q.eq("status", "aberto").lt("vcto", hoje).order("vcto");
    } else {
      const termo = (data.busca ?? "").trim();
      if (!termo) return { parcelas: [] };
      const digits = termo.replace(/\D/g, "");
      q =
        digits.length >= 4
          ? q.eq("cpf", digits.padStart(11, "0"))
          : q.ilike("nome_cliente", `%${termo}%`);
      q = q.order("vcto", { ascending: false });
    }

    const { data: rows, error } = await q.limit(300);
    if (error) throw new Error(error.message);
    return { parcelas: (rows ?? []) as ParcelaRow[] };
  });
