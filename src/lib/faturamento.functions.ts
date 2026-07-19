import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FatNfFila, FatNotaFiscal, FatParcela } from "./faturamento.server";

export type ParcelaRow = FatParcela & { id: number; fone?: string | null };

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
    // O PostgREST corta respostas em 1000 linhas; busca em paginas ate esgotar.
    const PAGE = 1000;
    const alunos: AlunoResumo[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .from("fat_alunos_resumo")
        .select("*")
        .order("cpf")
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      alunos.push(...((data ?? []) as AlunoResumo[]));
      if (!data || data.length < PAGE) break;
    }
    alunos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return { alunos };
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
    const parcelas = (rows ?? []) as ParcelaRow[];

    // Anexa o telefone do cadastro para o botao de cobranca via WhatsApp.
    const cpfs = [...new Set(parcelas.map((p) => p.cpf).filter(Boolean))] as string[];
    if (cpfs.length > 0) {
      const { data: clientes } = await db.from("fat_clientes").select("cpf, fone").in("cpf", cpfs);
      const fones = new Map(
        ((clientes ?? []) as { cpf: string; fone: string | null }[]).map((c) => [c.cpf, c.fone]),
      );
      for (const p of parcelas) p.fone = p.cpf ? (fones.get(p.cpf) ?? null) : null;
    }
    return { parcelas };
  });

export type NotaFiscalRow = FatNotaFiscal & { id: number };
export type NfFilaRow = FatNfFila & { id: number };

export const getNotasFiscais = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ fila: NfFilaRow[]; emitidas: NotaFiscalRow[] }> => {
    const db = await untypedDb();
    const [fila, emitidas] = await Promise.all([
      db.from("fat_nfs_fila").select("*").order("nome"),
      db.from("fat_notas_fiscais").select("*").order("data", { ascending: false }).limit(300),
    ]);
    if (fila.error) throw new Error(fila.error.message);
    if (emitidas.error) throw new Error(emitidas.error.message);
    return {
      fila: (fila.data ?? []) as NfFilaRow[],
      emitidas: (emitidas.data ?? []) as NotaFiscalRow[],
    };
  });
