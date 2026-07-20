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

export type FluxoCaixaMes = { mes: string; entradas: number; saidas: number };
export type FluxoCaixa = { historico: FluxoCaixaMes[]; projecao: FluxoCaixaMes[] };

function mesKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Fase 3: fluxo de caixa. Entradas = parcelas recebidas em /faturamento
// (fat_parcelas), saídas = despesas pagas em /financeiro (fin_contas_pagar).
// Projeção simples: em aberto (a receber − a pagar) por mês futuro; o que já
// venceu e não foi pago/recebido entra no mês atual.
export const getFluxoCaixa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<FluxoCaixa> => {
    const db = await untypedDb();
    const agora = new Date();
    const mesAtual = mesKey(agora);
    const inicio = new Date(agora.getFullYear(), agora.getMonth() - 11, 1);
    const inicioISO = `${mesKey(inicio)}-01`;

    // O PostgREST corta em 1000 linhas; pagina até esgotar (mesmo padrão de getAlunos).
    const PAGE = 1000;
    async function paginar<T>(
      build: (
        from: number,
        to: number,
      ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
    ): Promise<T[]> {
      const rows: T[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await build(from, from + PAGE - 1);
        if (error) throw new Error(error.message);
        rows.push(...(data ?? []));
        if (!data || data.length < PAGE) break;
      }
      return rows;
    }

    const [recebidas, aReceber, contas] = await Promise.all([
      paginar<{
        dt_recebimento: string;
        valor_recebido: number | null;
        valor_liquido: number | null;
        valor_parcela: number | null;
      }>((f, t) =>
        db
          .from("fat_parcelas")
          .select("dt_recebimento, valor_recebido, valor_liquido, valor_parcela")
          .gte("dt_recebimento", inicioISO)
          .range(f, t),
      ),
      paginar<{ vcto: string | null; valor_liquido: number | null; valor_parcela: number | null }>(
        (f, t) =>
          db
            .from("fat_parcelas")
            .select("vcto, valor_liquido, valor_parcela")
            .eq("status", "aberto")
            .range(f, t),
      ),
      paginar<{ vencimento: string; valor: number | null; pago: boolean; pago_em: string | null }>(
        (f, t) =>
          db.from("fin_contas_pagar").select("vencimento, valor, pago, pago_em").range(f, t),
      ),
    ]);

    const montarMeses = (base: Date, qtd: number) => {
      const lista: FluxoCaixaMes[] = [];
      const porMes = new Map<string, FluxoCaixaMes>();
      for (let i = 0; i < qtd; i++) {
        const item = {
          mes: mesKey(new Date(base.getFullYear(), base.getMonth() + i, 1)),
          entradas: 0,
          saidas: 0,
        };
        lista.push(item);
        porMes.set(item.mes, item);
      }
      return { lista, porMes };
    };

    const historico = montarMeses(inicio, 12);
    for (const r of recebidas) {
      const item = historico.porMes.get(r.dt_recebimento.slice(0, 7));
      if (item) item.entradas += r.valor_recebido ?? r.valor_liquido ?? r.valor_parcela ?? 0;
    }
    for (const c of contas) {
      if (!c.pago || !c.pago_em) continue;
      const item = historico.porMes.get(c.pago_em.slice(0, 7));
      if (item) item.saidas += c.valor ?? 0;
    }

    const projecao = montarMeses(agora, 6);
    const clamp = (mes: string) => (mes < mesAtual ? mesAtual : mes);
    for (const p of aReceber) {
      if (!p.vcto) continue;
      const item = projecao.porMes.get(clamp(p.vcto.slice(0, 7)));
      if (item) item.entradas += p.valor_liquido ?? p.valor_parcela ?? 0;
    }
    for (const c of contas) {
      if (c.pago) continue;
      const item = projecao.porMes.get(clamp(c.vencimento.slice(0, 7)));
      if (item) item.saidas += c.valor ?? 0;
    }

    return { historico: historico.lista, projecao: projecao.lista };
  });
