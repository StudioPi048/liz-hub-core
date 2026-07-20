import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

// Categorias fixas (decisao do plano: sem importar as 123 do Conta Azul).
export const CATEGORIAS_DESPESA = [
  { valor: "aluguel", rotulo: "Aluguel" },
  { valor: "salarios", rotulo: "Salários" },
  { valor: "marketing", rotulo: "Marketing" },
  { valor: "impostos", rotulo: "Impostos" },
  { valor: "docentes", rotulo: "Docentes" },
  { valor: "outros", rotulo: "Outros" },
] as const;

const categoriaEnum = z.enum([
  "aluguel",
  "salarios",
  "marketing",
  "impostos",
  "docentes",
  "outros",
]);

export type ContaPagarRow = {
  id: number;
  descricao: string;
  fornecedor: string | null;
  categoria: string;
  vencimento: string;
  valor: number;
  pago: boolean;
  pago_em: string | null;
};

async function untypedDb(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Tabela fin_contas_pagar ainda nao esta nos types gerados do Supabase.
  return supabaseAdmin as unknown as SupabaseClient;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Soma meses mantendo o dia, recuando para o ultimo dia do mes quando o dia
// nao existe (31/01 + 1 mes = 28/02, nao 03/03 como o Date faria sozinho).
export function addMesesISO(dateISO: string, meses: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const alvo = new Date(Date.UTC(y, m - 1 + meses, 1));
  const ultimoDia = new Date(
    Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0),
  ).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimoDia));
  return alvo.toISOString().slice(0, 10);
}

export const getContasPagar = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ contas: ContaPagarRow[] }> => {
    const db = await untypedDb();
    const { data, error } = await db
      .from("fin_contas_pagar")
      .select("id, descricao, fornecedor, categoria, vencimento, valor, pago, pago_em")
      .order("vencimento")
      .limit(2000);
    if (error) throw new Error(error.message);
    return { contas: (data ?? []) as ContaPagarRow[] };
  });

const criarInput = z.object({
  descricao: z.string().trim().min(1, "Informe a descrição."),
  fornecedor: z.string().optional(),
  categoria: categoriaEnum,
  vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  valor: z.number().positive("Informe o valor."),
  // Recorrencia simples: repete a mesma despesa nos N meses seguintes,
  // inserindo N+1 linhas de uma vez. Sem motor de recorrencia.
  repetirMeses: z.number().int().min(0).max(24).optional(),
});

export const criarContaPagar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => criarInput.parse(d))
  .handler(async ({ context, data }) => {
    const db = await untypedDb();
    const repetir = data.repetirMeses ?? 0;
    const linhas = [];
    for (let i = 0; i <= repetir; i++) {
      linhas.push({
        descricao: data.descricao.trim(),
        fornecedor: data.fornecedor?.trim() || null,
        categoria: data.categoria,
        vencimento: addMesesISO(data.vencimento, i),
        valor: data.valor,
        criado_por: context.userId,
      });
    }
    const { error } = await db.from("fin_contas_pagar").insert(linhas);
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const, criadas: linhas.length };
  });

const editarInput = z.object({
  id: z.number(),
  descricao: z.string().trim().min(1, "Informe a descrição."),
  fornecedor: z.string().optional(),
  categoria: categoriaEnum,
  vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  valor: z.number().positive("Informe o valor."),
});

export const editarContaPagar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => editarInput.parse(d))
  .handler(async ({ data }) => {
    const db = await untypedDb();
    const { error } = await db
      .from("fin_contas_pagar")
      .update({
        descricao: data.descricao.trim(),
        fornecedor: data.fornecedor?.trim() || null,
        categoria: data.categoria,
        vencimento: data.vencimento,
        valor: data.valor,
      })
      .eq("id", data.id);
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const };
  });

const pagarInput = z.object({ id: z.number(), pago: z.boolean() });

export const marcarContaPaga = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => pagarInput.parse(d))
  .handler(async ({ data }) => {
    const db = await untypedDb();
    const { error } = await db
      .from("fin_contas_pagar")
      .update({ pago: data.pago, pago_em: data.pago ? todayISO() : null })
      .eq("id", data.id);
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const };
  });

const excluirInput = z.object({ id: z.number() });

export const excluirContaPagar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => excluirInput.parse(d))
  .handler(async ({ data }) => {
    const db = await untypedDb();
    const { error } = await db.from("fin_contas_pagar").delete().eq("id", data.id);
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const };
  });
