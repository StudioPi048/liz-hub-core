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

const importarInput = z.object({
  // xlsx enviado manualmente, em base64; sem ele, baixa a planilha do Drive.
  arquivoBase64: z.string().optional(),
});

export const importarFaturamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => importarInput.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { runFaturamentoImport } = await import("./faturamento.server");
    try {
      const arquivo = data.arquivoBase64 ? Buffer.from(data.arquivoBase64, "base64") : undefined;
      const counts = await runFaturamentoImport(context.userId, arquivo);
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

const marcarRecebidaInput = z.object({
  parcelaId: z.number(),
  cpf: z.string().nullable(),
  vcto: z.string().nullable(),
  valor_parcela: z.number().nullable(),
  parcela_num: z.number().nullable(),
  curso_nome: z.string().nullable(),
  nome_cliente: z.string().nullable(),
  valor_recebido: z.number().nullable(),
});

export const marcarParcelaRecebida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => marcarRecebidaInput.parse(d))
  .handler(async ({ context, data }) => {
    const db = await untypedDb();
    const hoje = todayISO();
    const valor = data.valor_recebido ?? data.valor_parcela ?? 0;

    // Registro durável: sobrevive ao wipe + reload da importação (reaplicado por
    // reaplicarBaixas em runFaturamentoImport).
    const { error: insErr } = await db.from("fat_parcelas_baixas").insert({
      cpf: data.cpf,
      vcto: data.vcto,
      valor_parcela: data.valor_parcela,
      parcela_num: data.parcela_num,
      curso_nome: data.curso_nome,
      nome_cliente: data.nome_cliente,
      dt_recebimento: hoje,
      valor_recebido: valor,
      criado_por: context.userId,
    });
    if (insErr) return { ok: false as const, message: insErr.message };

    // Efeito imediato na parcela ativa: sai das listas de "aberto" e entra em
    // "recebido" — resumo, listas e relatórios já leem status/dt_recebimento.
    const { error: updErr } = await db
      .from("fat_parcelas")
      .update({ status: "pago", dt_recebimento: hoje, valor_recebido: valor })
      .eq("id", data.parcelaId);
    if (updErr) return { ok: false as const, message: updErr.message };
    return { ok: true as const };
  });

const desfazerBaixaInput = z.object({
  parcelaId: z.number(),
  cpf: z.string().nullable(),
  vcto: z.string().nullable(),
  valor_parcela: z.number().nullable(),
  parcela_num: z.number().nullable(),
});

export const desfazerBaixaParcela = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => desfazerBaixaInput.parse(d))
  .handler(async ({ data }) => {
    const db = await untypedDb();

    // Remove o registro durável (mesma assinatura usada por reaplicarBaixas),
    // senão a proxima importacao da planilha reaplicaria a baixa desfeita.
    if (data.cpf && data.vcto && data.valor_parcela !== null) {
      let q = db
        .from("fat_parcelas_baixas")
        .delete()
        .eq("cpf", data.cpf)
        .eq("vcto", data.vcto)
        .eq("valor_parcela", data.valor_parcela);
      if (data.parcela_num !== null) q = q.eq("parcela_num", data.parcela_num);
      const { error: delErr } = await q;
      if (delErr) return { ok: false as const, message: delErr.message };
    }

    const { error: updErr } = await db
      .from("fat_parcelas")
      .update({ status: "aberto", dt_recebimento: null, valor_recebido: null })
      .eq("id", data.parcelaId);
    if (updErr) return { ok: false as const, message: updErr.message };
    return { ok: true as const };
  });

export type NotaFiscalRow = FatNotaFiscal & { id: number };
export type NfFilaRow = FatNfFila & { id: number };

type NfEmitidaLocal = {
  cpf: string | null;
  nome: string | null;
  curso_nome: string | null;
  valor: number | null;
  numero: string | null;
  emitida_em: string;
};

export type FaturamentoRelatorios = {
  recebidoPorMes: { mes: string; total: number }[];
  recebidoPorCurso: { curso: string; total: number }[];
};

export const getFaturamentoRelatorios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<FaturamentoRelatorios> => {
    const db = await untypedDb();
    const hoje = new Date();
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1);
    const inicioISO = `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, "0")}-01`;

    // Recebido = parcelas com data de recebimento preenchida (mesmo criterio do resumo).
    const PAGE = 1000;
    const rows: {
      dt_recebimento: string;
      curso_nome: string | null;
      valor_recebido: number | null;
      valor_liquido: number | null;
      valor_parcela: number | null;
    }[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .from("fat_parcelas")
        .select("dt_recebimento, curso_nome, valor_recebido, valor_liquido, valor_parcela")
        .gte("dt_recebimento", inicioISO)
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }

    const porMes = new Map<string, number>();
    for (let i = 0; i < 12; i++) {
      const d = new Date(inicio.getFullYear(), inicio.getMonth() + i, 1);
      porMes.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, 0);
    }
    const porCurso = new Map<string, number>();
    for (const r of rows) {
      const valor = r.valor_recebido ?? r.valor_liquido ?? r.valor_parcela ?? 0;
      const mesKey = r.dt_recebimento.slice(0, 7);
      if (porMes.has(mesKey)) porMes.set(mesKey, (porMes.get(mesKey) ?? 0) + valor);
      const curso = r.curso_nome ?? "Sem curso";
      porCurso.set(curso, (porCurso.get(curso) ?? 0) + valor);
    }

    return {
      recebidoPorMes: [...porMes.entries()].map(([mes, total]) => ({ mes, total })),
      recebidoPorCurso: [...porCurso.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([curso, total]) => ({ curso, total })),
    };
  });

export const getNotasFiscais = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ fila: NfFilaRow[]; emitidas: NotaFiscalRow[] }> => {
    const db = await untypedDb();
    const [fila, emitidas, locais] = await Promise.all([
      db.from("fat_nfs_fila").select("*").order("nome"),
      db.from("fat_notas_fiscais").select("*").order("data", { ascending: false }).limit(300),
      db.from("fat_nfs_emitidas").select("*").order("emitida_em", { ascending: false }),
    ]);
    if (fila.error) throw new Error(fila.error.message);
    if (emitidas.error) throw new Error(emitidas.error.message);
    if (locais.error) throw new Error(locais.error.message);

    // A fila vem da planilha (wipe + reload); as marcadas como emitidas na
    // plataforma ficam em fat_nfs_emitidas e sao filtradas por cpf + curso.
    // ponytail: mesmo cliente comprando o mesmo curso 2x some da fila junto;
    // se acontecer na pratica, chavear tambem por valor.
    const locaisRows = (locais.data ?? []) as NfEmitidaLocal[];
    const emitidasChaves = new Set(locaisRows.map((n) => `${n.cpf}|${n.curso_nome}`));
    const filaRows = ((fila.data ?? []) as NfFilaRow[]).filter(
      (nf) => !emitidasChaves.has(`${nf.cpf}|${nf.curso_nome}`),
    );

    // Lista de emitidas = historico da planilha + marcadas na plataforma.
    const emitidasLocais: NotaFiscalRow[] = locaisRows.map((n, i) => ({
      id: -(i + 1), // ids negativos para nao colidir com os da planilha
      data: n.emitida_em,
      cliente: n.nome,
      numero: n.numero,
      valor: n.valor,
    }));
    const todas = [...emitidasLocais, ...((emitidas.data ?? []) as NotaFiscalRow[])].sort((a, b) =>
      (b.data ?? "").localeCompare(a.data ?? ""),
    );

    return { fila: filaRows, emitidas: todas };
  });

const marcarEmitidaInput = z.object({
  cpf: z.string().nullable(),
  nome: z.string().nullable(),
  curso_nome: z.string().nullable(),
  valor: z.number().nullable(),
  numero: z.string().min(1, "Informe o número da nota."),
});

const criarAlunoInput = z.object({
  cpf: z.string().min(1, "Informe o CPF."),
  nome: z.string().min(1, "Informe o nome."),
  email: z.string().optional(),
  endereco: z.string().optional(),
  cidade_uf: z.string().optional(),
  fone: z.string().optional(),
});

export const criarAlunoLocal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => criarAlunoInput.parse(d))
  .handler(async ({ context, data }) => {
    const { normalizeCpf } = await import("./faturamento.server");
    const cpf = normalizeCpf(data.cpf);
    if (!cpf) return { ok: false as const, message: "CPF inválido." };
    const db = await untypedDb();

    // "Novo aluno" é só para quem ainda não existe — sem essa checagem, um CPF
    // que já está em fat_clientes (planilha ou cadastro anterior) teria seus
    // dados sobrescritos silenciosamente pelo upsert abaixo.
    const { data: existente } = await db
      .from("fat_clientes")
      .select("nome")
      .eq("cpf", cpf)
      .maybeSingle();
    if (existente) {
      return {
        ok: false as const,
        message: `Já existe um aluno com esse CPF: ${(existente as { nome: string }).nome}.`,
      };
    }

    const cliente = {
      cpf,
      nome: data.nome.trim(),
      email: data.email?.trim() || null,
      endereco: data.endereco?.trim() || null,
      cidade_uf: data.cidade_uf?.trim() || null,
      fone: data.fone?.trim() || null,
    };

    // Efeito imediato (aparece já na lista de alunos) + registro durável que
    // sobrevive ao wipe+reload da próxima importação da planilha.
    const { error: upsertErr } = await db
      .from("fat_clientes")
      .upsert(cliente, { onConflict: "cpf" });
    if (upsertErr) return { ok: false as const, message: upsertErr.message };

    const { error: localErr } = await db
      .from("fat_clientes_locais")
      .upsert({ ...cliente, criado_por: context.userId }, { onConflict: "cpf" });
    if (localErr) return { ok: false as const, message: localErr.message };

    return { ok: true as const, cpf };
  });

export type CursoOpcao = { codigo: string; nome: string; valor_brl: number | null };
export type PlanoOpcao = {
  id_plano: string;
  nome: string;
  parcelas: number | null;
  prazo_dias: number | null;
};

export const getCursosPlanos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ cursos: CursoOpcao[]; planos: PlanoOpcao[] }> => {
    const db = await untypedDb();
    const [cursos, planos] = await Promise.all([
      db.from("fat_cursos").select("codigo, nome, valor_brl").order("nome"),
      db.from("fat_planos").select("id_plano, nome, parcelas, prazo_dias").order("nome"),
    ]);
    if (cursos.error) throw new Error(cursos.error.message);
    if (planos.error) throw new Error(planos.error.message);
    return {
      cursos: (cursos.data ?? []) as CursoOpcao[],
      planos: (planos.data ?? []) as PlanoOpcao[],
    };
  });

function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + Math.round(days));
  return dt.toISOString().slice(0, 10);
}

// ponytail: espaça as parcelas em intervalos iguais dentro do prazo do plano
// (sem a fórmula real da planilha, que não temos). Se o Denilson achar as
// datas erradas para algum plano específico, é aqui que ajustar.
function gerarParcelas(
  dtVenda: string,
  numParcelas: number,
  prazoDias: number | null,
  valorVenda: number,
): { parcela_num: number; vcto: string; valor_parcela: number }[] {
  const step = prazoDias && numParcelas > 0 ? prazoDias / numParcelas : 30;
  const centavos = Math.round(valorVenda * 100);
  const base = Math.floor(centavos / numParcelas);
  const resto = centavos - base * numParcelas;
  const parcelas = [];
  for (let i = 1; i <= numParcelas; i++) {
    const valorCent = base + (i === numParcelas ? resto : 0);
    parcelas.push({
      parcela_num: i,
      vcto: addDaysISO(dtVenda, step * i),
      valor_parcela: valorCent / 100,
    });
  }
  return parcelas;
}

const registrarVendaInput = z.object({
  cpf: z.string().min(1, "Selecione o aluno."),
  cursoCodigo: z.string().min(1, "Selecione o curso."),
  planoId: z.string().min(1, "Selecione o plano."),
  valorVenda: z.number().positive("Informe o valor da venda."),
  desconto: z.number().optional(),
  dtVenda: z.string().optional(),
});

export const registrarVenda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => registrarVendaInput.parse(d))
  .handler(async ({ context, data }) => {
    const db = await untypedDb();

    const [clienteRes, cursoRes, planoRes] = await Promise.all([
      db.from("fat_clientes").select("cpf, nome").eq("cpf", data.cpf).maybeSingle(),
      db
        .from("fat_cursos")
        .select("codigo, nome, valor_brl")
        .eq("codigo", data.cursoCodigo)
        .maybeSingle(),
      db
        .from("fat_planos")
        .select("id_plano, nome, parcelas, prazo_dias")
        .eq("id_plano", data.planoId)
        .maybeSingle(),
    ]);
    if (!clienteRes.data) return { ok: false as const, message: "Aluno não encontrado." };
    if (!cursoRes.data) return { ok: false as const, message: "Curso não encontrado." };
    if (!planoRes.data) return { ok: false as const, message: "Plano não encontrado." };

    const curso = cursoRes.data as { codigo: string; nome: string; valor_brl: number | null };
    const plano = planoRes.data as {
      id_plano: string;
      nome: string;
      parcelas: number | null;
      prazo_dias: number | null;
    };
    const numParcelas = plano.parcelas && plano.parcelas > 0 ? plano.parcelas : 1;
    const dtVenda = data.dtVenda ?? todayISO();
    const desconto = data.desconto ?? 0;

    const { data: venda, error: vendaErr } = await db
      .from("fat_vendas_locais")
      .insert({
        cpf: data.cpf,
        nome_cliente: (clienteRes.data as { nome: string }).nome,
        id_curso: curso.codigo,
        curso_nome: curso.nome,
        id_plano: plano.id_plano,
        plano_nome: plano.nome,
        valor_tabela: curso.valor_brl,
        desconto,
        valor_venda: data.valorVenda,
        num_parcelas: numParcelas,
        prazo_dias: plano.prazo_dias,
        dt_venda: dtVenda,
        criado_por: context.userId,
      })
      .select("id")
      .single();
    if (vendaErr || !venda)
      return { ok: false as const, message: vendaErr?.message ?? "Falha ao criar venda." };

    const parcelas = gerarParcelas(dtVenda, numParcelas, plano.prazo_dias, data.valorVenda);

    const { error: parcelasLocaisErr } = await db
      .from("fat_parcelas_locais")
      .insert(parcelas.map((p) => ({ venda_id: (venda as { id: number }).id, ...p })));
    if (parcelasLocaisErr) return { ok: false as const, message: parcelasLocaisErr.message };

    // Efeito imediato: a venda já aparece em Cobranças do mês sem precisar
    // reimportar a planilha.
    const { error: parcelasErr } = await db.from("fat_parcelas").insert(
      parcelas.map((p) => ({
        cpf: data.cpf,
        nome_cliente: (clienteRes.data as { nome: string }).nome,
        dt_venda: dtVenda,
        id_curso: curso.codigo,
        curso_nome: curso.nome,
        valor_tabela: curso.valor_brl,
        desconto,
        valor_venda: data.valorVenda,
        id_plano: plano.id_plano,
        plano_nome: plano.nome,
        prazo: plano.prazo_dias,
        parcela_num: p.parcela_num,
        vcto: p.vcto,
        valor_parcela: p.valor_parcela,
        valor_liquido: p.valor_parcela,
        status: "aberto",
      })),
    );
    if (parcelasErr) return { ok: false as const, message: parcelasErr.message };

    return { ok: true as const, numParcelas };
  });

export const marcarNotaEmitida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => marcarEmitidaInput.parse(d))
  .handler(async ({ context, data }) => {
    const db = await untypedDb();
    const { error } = await db.from("fat_nfs_emitidas").insert({
      cpf: data.cpf,
      nome: data.nome,
      curso_nome: data.curso_nome,
      valor: data.valor,
      numero: data.numero,
      criado_por: context.userId,
    });
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const };
  });
