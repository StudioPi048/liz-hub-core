// Importador do faturamento: le a planilha "Faturamento" do Google Drive (xlsx export)
// e recarrega as tabelas fat_* no Supabase. Fonte da verdade atual e a planilha;
// cada importacao apaga e regrava tudo (wipe + reload).
import * as XLSX from "xlsx";
import type { SupabaseClient } from "@supabase/supabase-js";

// Planilha "Faturamento Julho 26" na pasta "Planilhas LIZ" do Drive.
const FATURAMENTO_SHEET_ID =
  process.env.FATURAMENTO_SHEET_ID ?? "1YD1ue0y-_kTFpZn9x9d2mZG1jdnstebok8_k752twfQ";

// O export CSV por aba respeita filtros ativos e esconde linhas; o xlsx traz tudo.
export function faturamentoSheetUrl(): string {
  return `https://docs.google.com/spreadsheets/d/${FATURAMENTO_SHEET_ID}/export?format=xlsx`;
}

export type FatCliente = {
  cpf: string;
  nome: string;
  email: string | null;
  endereco: string | null;
  cidade_uf: string | null;
  fone: string | null;
};

export type FatCurso = {
  codigo: string;
  nome: string;
  docente: string | null;
  valor_brl: number | null;
  valor_eur: number | null;
  tipo: "curso" | "livro";
};

export type FatPlano = {
  id_plano: string;
  nome: string;
  parcelas: number | null;
  prazo_dias: number | null;
  taxa: string | null;
};

export type FatParcela = {
  cpf: string | null;
  nome_cliente: string | null;
  dt_venda: string | null;
  id_curso: string | null;
  curso_nome: string | null;
  docente: string | null;
  escola: string | null;
  valor_tabela: number | null;
  desconto: number | null;
  valor_venda: number | null;
  id_plano: string | null;
  plano_nome: string | null;
  prazo: number | null;
  parcela_num: number | null;
  vcto: string | null;
  valor_parcela: number | null;
  valor_liquido: number | null;
  dt_recebimento: string | null;
  valor_recebido: number | null;
  status: string;
  atraso_dias: number | null;
};

export function normalizeCpf(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  // Na planilha o CPF aparece como texto formatado ou como numero (perde zeros a esquerda).
  const digits =
    typeof value === "number" ? String(Math.round(value)) : String(value).replace(/\D/g, "");
  if (!digits) return null;
  return digits.padStart(11, "0").slice(0, 14);
}

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  // Formato BR: "R$  1.740,00", "0,00%"
  const cleaned = String(value)
    .replace(/[R$€%\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function toDateISO(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    // Celulas de data do xlsx viram Date em UTC-ish; usar componentes locais do parse.
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(value).trim();
  // dd/mm/yy ou dd/mm/yyyy
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    const [, d, m, y] = br;
    const year = y.length === 2 ? Number(y) + 2000 : Number(y);
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

export function normalizeStatus(value: unknown): string {
  const s = String(value ?? "")
    .trim()
    .toLowerCase();
  if (s === "ok") return "pago";
  if (s === "aberto") return "aberto";
  if (s === "cancelado") return "cancelado";
  if (s === "perda") return "perda";
  if (s === "permuta") return "permuta";
  if (s === "novo contrato") return "novo_contrato";
  if (!s) return "aberto";
  return "outro";
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s || null;
}

function sheetRows(wb: XLSX.WorkBook, name: string): unknown[][] {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
}

// Localiza o cabecalho pelo texto exato da celula, em qualquer coluna.
// O SheetJS corta colunas iniciais vazias (ex: aba PLANOS comeca em B1),
// entao os indices absolutos mudam; tudo e lido relativo a coluna do rotulo.
function findHeader(rows: unknown[][], label: string): { row: number; col: number } | null {
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] ?? [];
    for (let j = 0; j < r.length; j++) {
      if (String(r[j] ?? "").trim() === label) return { row: i, col: j };
    }
  }
  return null;
}

export type FatNotaFiscal = {
  data: string | null;
  cliente: string | null;
  numero: string | null;
  valor: number | null;
};

export type FatNfFila = {
  cpf: string | null;
  nome: string | null;
  email: string | null;
  endereco: string | null;
  cidade_uf: string | null;
  fone: string | null;
  id_curso: string | null;
  curso_nome: string | null;
  valor_venda: number | null;
  id_plano: string | null;
  plano_nome: string | null;
};

export type FaturamentoParsed = {
  clientes: FatCliente[];
  cursos: FatCurso[];
  planos: FatPlano[];
  parcelas: FatParcela[];
  notasFiscais: FatNotaFiscal[];
  nfsFila: FatNfFila[];
};

export function parseFaturamentoWorkbook(data: ArrayBuffer | Buffer): FaturamentoParsed {
  const wb = XLSX.read(data, { type: "buffer", cellDates: true });

  // CLIENTES: CPF | NOME | E-MAIL | ENDERECO | CIDADE/UF | FONE (ancora: celula "CPF")
  const clientesRows = sheetRows(wb, "CLIENTES");
  const clientesHeader = findHeader(clientesRows, "CPF");
  const clientesMap = new Map<string, FatCliente>();
  if (clientesHeader) {
    const c = clientesHeader.col;
    for (const r of clientesRows.slice(clientesHeader.row + 1)) {
      const cpf = normalizeCpf(r[c]);
      const nome = text(r[c + 1]);
      if (!cpf || !nome) continue;
      clientesMap.set(cpf, {
        cpf,
        nome,
        email: text(r[c + 2]),
        endereco: text(r[c + 3]),
        cidade_uf: text(r[c + 4]),
        fone: text(r[c + 5]),
      });
    }
  }

  // PRECOS (cursos): Codigo | Modulos | Docente | Valor R$ | Valor EUR
  const cursosMap = new Map<string, FatCurso>();
  const precosRows = sheetRows(wb, "PREÇOS");
  const precosHeader = findHeader(precosRows, "Código");
  if (precosHeader) {
    const c = precosHeader.col;
    for (const r of precosRows.slice(precosHeader.row + 1)) {
      const codigo = text(toNumber(r[c]) !== null ? String(Math.round(toNumber(r[c])!)) : r[c]);
      const nome = text(r[c + 1]);
      if (!codigo || !nome) continue;
      cursosMap.set(codigo, {
        codigo,
        nome,
        docente: text(r[c + 2]),
        valor_brl: toNumber(r[c + 3]),
        valor_eur: toNumber(r[c + 4]),
        tipo: "curso",
      });
    }
  }

  // Livros: CODIGO | NOME | AUTOR | PRECO
  const livrosRows = sheetRows(wb, "Livros");
  const livrosHeader = findHeader(livrosRows, "CÓDIGO");
  if (livrosHeader) {
    const c = livrosHeader.col;
    for (const r of livrosRows.slice(livrosHeader.row + 1)) {
      const raw = toNumber(r[c]);
      const codigo = text(raw !== null ? String(raw) : r[c]);
      const nome = text(r[c + 1]);
      if (!codigo || !nome) continue;
      cursosMap.set(codigo, {
        codigo,
        nome,
        docente: text(r[c + 2]),
        valor_brl: toNumber(r[c + 3]),
        valor_eur: null,
        tipo: "livro",
      });
    }
  }

  // PLANOS: ID_plano | Nome Plano | Parcelas | Prazo(dias) | Taxa(am)
  const planosMap = new Map<string, FatPlano>();
  const planosRows = sheetRows(wb, "PLANOS");
  const planosHeader = findHeader(planosRows, "ID_plano");
  if (planosHeader) {
    const c = planosHeader.col;
    for (const r of planosRows.slice(planosHeader.row + 1)) {
      const id = text(r[c]);
      const nome = text(r[c + 1]);
      if (!id || !nome) continue;
      planosMap.set(id, {
        id_plano: id,
        nome,
        parcelas: toNumber(r[c + 2]) !== null ? Math.round(toNumber(r[c + 2])!) : null,
        prazo_dias: toNumber(r[c + 3]) !== null ? Math.round(toNumber(r[c + 3])!) : null,
        taxa: text(r[c + 4]),
      });
    }
  }

  // BASE: cada linha = uma parcela de uma venda.
  const baseRows = sheetRows(wb, "BASE");
  const baseHeader = findHeader(baseRows, "CPF");
  const parcelas: FatParcela[] = [];
  if (baseHeader) {
    const c = baseHeader.col;
    for (const r of baseRows.slice(baseHeader.row + 1)) {
      const cpf = normalizeCpf(r[c]);
      const nome = text(r[c + 1]);
      if (!cpf && !nome) continue;
      const idCursoNum = toNumber(r[c + 3]);
      parcelas.push({
        cpf,
        nome_cliente: nome,
        dt_venda: toDateISO(r[c + 2]),
        id_curso: idCursoNum !== null ? String(Math.round(idCursoNum)) : text(r[c + 3]),
        curso_nome: text(r[c + 4]),
        docente: text(r[c + 5]),
        escola: text(r[c + 6]),
        valor_tabela: toNumber(r[c + 7]),
        desconto: toNumber(r[c + 8]),
        valor_venda: toNumber(r[c + 9]),
        id_plano: text(r[c + 10]),
        plano_nome: text(r[c + 11]),
        prazo: toNumber(r[c + 12]) !== null ? Math.round(toNumber(r[c + 12])!) : null,
        parcela_num: toNumber(r[c + 13]),
        vcto: toDateISO(r[c + 15]),
        valor_parcela: toNumber(r[c + 16]),
        valor_liquido: toNumber(r[c + 17]),
        dt_recebimento: toDateISO(r[c + 18]),
        valor_recebido: toNumber(r[c + 19]),
        status: normalizeStatus(r[c + 20]),
        atraso_dias: toNumber(r[c + 21]) !== null ? Math.round(toNumber(r[c + 21])!) : null,
      });
    }
  }

  // Nota Fiscal (historico de NFs emitidas): Data | Cliente | Nota Fiscal | Valor
  const notasFiscais: FatNotaFiscal[] = [];
  const nfRows = sheetRows(wb, "Nota Fiscal");
  const nfHeader = findHeader(nfRows, "Nota Fiscal");
  if (nfHeader) {
    const c = nfHeader.col; // rotulo fica na 3a coluna; data/cliente ficam antes
    for (const r of nfRows.slice(nfHeader.row + 1)) {
      const cliente = text(r[c - 1]);
      const numeroNum = toNumber(r[c]);
      if (!cliente) continue;
      notasFiscais.push({
        data: toDateISO(r[c - 2]),
        cliente,
        numero: numeroNum !== null ? String(Math.round(numeroNum)) : text(r[c]),
        valor: toNumber(r[c + 1]),
      });
    }
  }

  // Nfs. Dressler (fila de NFs a emitir via Senior):
  // CPF | NOME | E-MAIL | ENDERECO | CIDADE/UF | FONE | ID_Curso | Modulos | R$_Venda | ID_plano | Plano
  const nfsFila: FatNfFila[] = [];
  const filaRows = sheetRows(wb, "Nfs. Dressler");
  const filaHeader = findHeader(filaRows, "CPF");
  if (filaHeader) {
    const c = filaHeader.col;
    for (const r of filaRows.slice(filaHeader.row + 1)) {
      const cpf = normalizeCpf(r[c]);
      const nome = text(r[c + 1]);
      if (!cpf && !nome) continue;
      const idCursoNum = toNumber(r[c + 6]);
      nfsFila.push({
        cpf,
        nome,
        email: text(r[c + 2]),
        endereco: text(r[c + 3]),
        cidade_uf: text(r[c + 4]),
        fone: text(r[c + 5]),
        id_curso: idCursoNum !== null ? String(Math.round(idCursoNum)) : text(r[c + 6]),
        curso_nome: text(r[c + 7]),
        valor_venda: toNumber(r[c + 8]),
        id_plano: text(r[c + 9]),
        plano_nome: text(r[c + 10]),
      });
    }
  }

  return {
    clientes: [...clientesMap.values()],
    cursos: [...cursosMap.values()],
    planos: [...planosMap.values()],
    parcelas,
    notasFiscais,
    nfsFila,
  };
}

async function insertBatches(
  db: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await db.from(table).insert(rows.slice(i, i + BATCH));
    if (error) throw new Error(`Falha ao gravar ${table}: ${error.message}`);
  }
}

export async function runFaturamentoImport(
  userId: string,
  arquivo?: Buffer,
): Promise<{
  clientes: number;
  cursos: number;
  planos: number;
  parcelas: number;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Tabelas fat_* ainda nao estao nos types gerados; cliente sem tipagem de schema.
  const db = supabaseAdmin as unknown as SupabaseClient;

  // Arquivo enviado manualmente tem prioridade; sem ele, baixa do Drive (link publico).
  let buf = arquivo;
  if (!buf) {
    const res = await fetch(faturamentoSheetUrl(), { redirect: "follow" });
    if (!res.ok) {
      throw new Error(
        `Nao consegui baixar a planilha do Drive (HTTP ${res.status}). ` +
          `Se o compartilhamento foi restringido, use o botao "Enviar arquivo da planilha".`,
      );
    }
    buf = Buffer.from(await res.arrayBuffer());
  }
  const parsed = parseFaturamentoWorkbook(buf);

  if (parsed.parcelas.length === 0) {
    throw new Error("A planilha foi lida mas nenhuma parcela foi encontrada na aba BASE.");
  }

  // Wipe + reload: a planilha e a fonte da verdade nesta fase.
  for (const [table, key] of [
    ["fat_parcelas", "id"],
    ["fat_clientes", "cpf"],
    ["fat_cursos", "codigo"],
    ["fat_planos", "id_plano"],
    ["fat_notas_fiscais", "id"],
    ["fat_nfs_fila", "id"],
  ] as const) {
    const { error } = await db.from(table).delete().not(key, "is", null);
    if (error) throw new Error(`Falha ao limpar ${table}: ${error.message}`);
  }

  await insertBatches(db, "fat_clientes", parsed.clientes);
  await insertBatches(db, "fat_cursos", parsed.cursos);
  await insertBatches(db, "fat_planos", parsed.planos);
  await insertBatches(db, "fat_parcelas", parsed.parcelas);
  await insertBatches(db, "fat_notas_fiscais", parsed.notasFiscais);
  await insertBatches(db, "fat_nfs_fila", parsed.nfsFila);

  const counts = {
    clientes: parsed.clientes.length,
    cursos: parsed.cursos.length,
    planos: parsed.planos.length,
    parcelas: parsed.parcelas.length,
    notasFiscais: parsed.notasFiscais.length,
    nfsFila: parsed.nfsFila.length,
  };

  await db.from("fat_import_status").upsert({
    id: "system",
    imported_at: new Date().toISOString(),
    imported_by: userId,
    clientes_count: counts.clientes,
    parcelas_count: counts.parcelas,
    cursos_count: counts.cursos,
    planos_count: counts.planos,
    last_error: null,
  });

  return counts;
}
