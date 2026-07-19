import crypto from "node:crypto";

const DEFAULT_API_BASE_URL = "https://api-v2.contaazul.com";
const DEFAULT_AUTH_BASE_URL = "https://auth.contaazul.com";
const CONTA_AZUL_SCOPE = "openid profile aws.cognito.signin.user.admin";
const TOKEN_REFRESH_MARGIN_MS = 60_000;
const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 3600;
const SYSTEM_CONNECTION_ID = "system";

export type ContaAzulHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type ContaAzulJsonValue =
  string | number | boolean | null | ContaAzulJsonValue[] | { [key: string]: ContaAzulJsonValue };
export type ContaAzulJsonRecord = { [key: string]: ContaAzulJsonValue };

export type ContaAzulBackofficeAction = {
  id: string;
  label: string;
  description: string;
  method: ContaAzulHttpMethod;
  path: string;
  requiresId?: boolean;
  idLabel?: string;
  queryTemplate?: ContaAzulJsonRecord;
  bodyTemplate?: ContaAzulJsonValue;
  dangerous?: boolean;
  docsUrl?: string;
};

export type ContaAzulBackofficeModule = {
  id: string;
  label: string;
  description: string;
  defaultActionId: string;
  actions: ContaAzulBackofficeAction[];
};

export type ContaAzulOperationInput = {
  moduleId: string;
  actionId: string;
  id?: string;
  query?: ContaAzulJsonRecord;
  body?: ContaAzulJsonValue;
};

export type ContaAzulOperationResult = {
  ok: true;
  moduleId: string;
  actionId: string;
  method: ContaAzulHttpMethod;
  path: string;
  performedAt: string;
  responseShape: string;
  listSource: string | null;
  itemCount: number;
  items: ContaAzulJsonValue[];
  data: ContaAzulJsonValue;
};

type ContaAzulTokenPayload = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  id_token?: string;
};

type ContaAzulTokenRow = {
  id: string;
  connected_by: string | null;
  conta_azul_identity: Record<string, unknown> | null;
  access_token_ciphertext: string | null;
  refresh_token_ciphertext: string;
  token_expires_at: string | null;
  scope: string | null;
  token_type: string | null;
  status: "connected" | "needs_reconnect" | "error";
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

type SupabaseErrorLike = { message: string };

type ContaAzulTokensTable = {
  upsert(values: Record<string, unknown>): Promise<{ error: SupabaseErrorLike | null }>;
  select(columns: string): {
    eq(
      column: string,
      value: string,
    ): {
      maybeSingle(): Promise<{ data: ContaAzulTokenRow | null; error: SupabaseErrorLike | null }>;
    };
  };
  update(values: Record<string, unknown>): {
    eq(column: string, value: string): Promise<{ error: SupabaseErrorLike | null }>;
  };
  delete(): {
    eq(column: string, value: string): Promise<{ error: SupabaseErrorLike | null }>;
  };
};

type ContaAzulAccessTokenResult =
  | {
      status: "connected";
      accessToken: string;
      connectedAt: string;
      connectedBy: string | null;
      identity: Record<string, unknown> | null;
      tokenExpiresAt: string | null;
      lastError: string | null;
    }
  | { status: "disconnected"; reason: "not_connected" }
  | {
      status: "needs_reconnect";
      reason: "invalid_client" | "invalid_grant";
      lastError: string | null;
    }
  | { status: "temporarily_unavailable"; reason: "network_error" | "conta_azul_unavailable" };

export type ContaAzulSafeStatus =
  | Omit<Extract<ContaAzulAccessTokenResult, { status: "connected" }>, "accessToken">
  | Exclude<ContaAzulAccessTokenResult, { status: "connected" }>;

class ContaAzulTokenEndpointError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
  ) {
    super(message);
    this.name = "ContaAzulTokenEndpointError";
  }
}

class ContaAzulConnectionUnavailableError extends Error {
  constructor(readonly result: Exclude<ContaAzulAccessTokenResult, { status: "connected" }>) {
    super("Conta Azul is not connected.");
    this.name = "ContaAzulConnectionUnavailableError";
  }
}

const DEFAULT_LIST_QUERY = {
  pagina: 1,
  tamanho_pagina: 20,
} satisfies ContaAzulJsonRecord;

// A API exige data_vencimento_de/ate em contas a receber/pagar; campos vazios
// sao removidos da query e causavam HTTP 400. Modelo ja vem com o mes atual.
function monthStartISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthEndISO(): string {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
}

const CONTA_AZUL_BACKOFFICE_MODULES: ContaAzulBackofficeModule[] = [
  {
    id: "financeiro",
    label: "Financeiro",
    description:
      "Categorias, centros de custo, contas financeiras, contas a receber, contas a pagar, baixas, transferências e saldos.",
    defaultActionId: "search-receivables",
    actions: [
      {
        id: "list-categories",
        label: "Listar categorias financeiras",
        description: "Carrega as categorias financeiras validadas pela Conta Azul.",
        method: "GET",
        path: "/v1/categorias",
        queryTemplate: {
          ...DEFAULT_LIST_QUERY,
          busca: "",
          tipo: "",
          apenas_filhos: false,
        },
        docsUrl: "https://developers.contaazul.com/docs/financial-apis-openapi",
      },
      {
        id: "list-dre-categories",
        label: "Listar categorias DRE",
        description: "Consulta a estrutura de categorias DRE usada no fechamento financeiro.",
        method: "GET",
        path: "/v1/financeiro/categorias-dre",
        docsUrl: "https://developers.contaazul.com/docs/financial-apis-openapi",
      },
      {
        id: "list-cost-centers",
        label: "Listar centros de custo",
        description: "Busca centros de custo por paginação, texto e status.",
        method: "GET",
        path: "/v1/centro-de-custo",
        queryTemplate: { ...DEFAULT_LIST_QUERY, busca: "", filtro_rapido: "ATIVO" },
        docsUrl: "https://developers.contaazul.com/docs/financial-apis-openapi",
      },
      {
        id: "create-cost-center",
        label: "Criar centro de custo",
        description: "Cria um centro de custo para classificar lançamentos.",
        method: "POST",
        path: "/v1/centro-de-custo",
        bodyTemplate: { codigo: "", nome: "" },
        docsUrl: "https://developers.contaazul.com/docs/financial-apis-openapi/v1/createcostcenter",
      },
      {
        id: "list-financial-accounts",
        label: "Listar contas financeiras",
        description: "Consulta contas bancárias, cartões e meios de recebimento.",
        method: "GET",
        path: "/v1/conta-financeira",
        queryTemplate: { ...DEFAULT_LIST_QUERY, nome: "", apenas_ativo: true },
        docsUrl:
          "https://developers.contaazul.com/docs/financial-apis-openapi/v1/searchfinancialaccounts",
      },
      {
        id: "get-financial-account-balance",
        label: "Consultar saldo da conta",
        description: "Retorna o saldo atual de uma conta financeira por ID.",
        method: "GET",
        path: "/v1/conta-financeira/{id_conta_financeira}/saldo-atual",
        requiresId: true,
        idLabel: "ID da conta financeira",
        docsUrl:
          "https://developers.contaazul.com/docs/financial-apis-openapi/v1/searchfinancialaccounts",
      },
      {
        id: "search-receivables",
        label: "Buscar contas a receber",
        description: "Consulta receitas por vencimento, cliente, categoria, status e valores.",
        method: "GET",
        path: "/v1/financeiro/eventos-financeiros/contas-a-receber/buscar",
        queryTemplate: {
          ...DEFAULT_LIST_QUERY,
          descricao: "",
          status: [],
          data_vencimento_de: monthStartISO(),
          data_vencimento_ate: monthEndISO(),
        },
        docsUrl:
          "https://developers.contaazul.com/docs/financial-apis-openapi/v1/searchfinancialaccounts",
      },
      {
        id: "create-receivable",
        label: "Criar conta a receber",
        description: "Cria um evento financeiro de receita com parcelas e condição de pagamento.",
        method: "POST",
        path: "/v1/financeiro/eventos-financeiros/contas-a-receber",
        bodyTemplate: {
          data_competencia: "2026-07-19",
          valor: 0,
          observacao: "",
          descricao: "",
          contato: "",
          conta_financeira: "",
          condicao_pagamento: { parcelas: [] },
        },
        docsUrl:
          "https://developers.contaazul.com/docs/financial-apis-openapi/v1/createreceivablefinancialevent",
      },
      {
        id: "search-payables",
        label: "Buscar contas a pagar",
        description: "Consulta despesas por vencimento, competência, categoria, status e valores.",
        method: "GET",
        path: "/v1/financeiro/eventos-financeiros/contas-a-pagar/buscar",
        queryTemplate: {
          ...DEFAULT_LIST_QUERY,
          descricao: "",
          status: [],
          data_vencimento_de: monthStartISO(),
          data_vencimento_ate: monthEndISO(),
        },
        docsUrl: "https://developers.contaazul.com/docs/financial-apis-openapi",
      },
      {
        id: "create-payable",
        label: "Criar conta a pagar",
        description: "Cria um evento financeiro de despesa no ERP.",
        method: "POST",
        path: "/v1/financeiro/eventos-financeiros/contas-a-pagar",
        bodyTemplate: {
          data_competencia: "2026-07-19",
          valor: 0,
          observacao: "",
          descricao: "",
          contato: "",
          conta_financeira: "",
          condicao_pagamento: { parcelas: [] },
        },
        docsUrl: "https://developers.contaazul.com/docs/financial-apis-openapi",
      },
      {
        id: "list-installments",
        label: "Listar parcelas do evento",
        description: "Consulta as parcelas de um evento financeiro.",
        method: "GET",
        path: "/v1/financeiro/eventos-financeiros/{id_evento}/parcelas",
        requiresId: true,
        idLabel: "ID do evento financeiro",
        docsUrl: "https://developers.contaazul.com/docs/financial-apis-openapi",
      },
      {
        id: "settle-installment",
        label: "Baixar parcela",
        description: "Registra baixa/pagamento de uma parcela financeira.",
        method: "POST",
        path: "/v1/financeiro/eventos-financeiros/parcelas/{parcela_id}/baixa",
        requiresId: true,
        idLabel: "ID da parcela",
        bodyTemplate: {
          data_pagamento: "2026-07-19",
          valor_pago: 0,
          conta_financeira: "",
          observacao: "",
        },
        docsUrl: "https://developers.contaazul.com/docs/financial-apis-openapi",
      },
      {
        id: "get-installment-settlements",
        label: "Consultar baixas da parcela",
        description: "Lista as baixas registradas em uma parcela.",
        method: "GET",
        path: "/v1/financeiro/eventos-financeiros/parcelas/{parcela_id}/baixa",
        requiresId: true,
        idLabel: "ID da parcela",
        docsUrl: "https://developers.contaazul.com/docs/financial-apis-openapi",
      },
      {
        id: "delete-settlement",
        label: "Excluir baixa",
        description: "Remove uma baixa financeira pelo ID.",
        method: "DELETE",
        path: "/v1/financeiro/eventos-financeiros/parcelas/baixa/{baixa_id}",
        requiresId: true,
        idLabel: "ID da baixa",
        dangerous: true,
        docsUrl: "https://developers.contaazul.com/docs/financial-apis-openapi",
      },
      {
        id: "list-transfers",
        label: "Listar transferências",
        description: "Consulta transferências entre contas financeiras.",
        method: "GET",
        path: "/v1/financeiro/transferencias",
        queryTemplate: {
          ...DEFAULT_LIST_QUERY,
          ids_conta_financeira: [],
          data_inicio: "",
          data_fim: "",
        },
        docsUrl: "https://developers.contaazul.com/docs/financial-apis-openapi",
      },
      {
        id: "list-financial-changes",
        label: "Listar alterações financeiras",
        description: "Consulta eventos financeiros alterados em um intervalo.",
        method: "GET",
        path: "/v1/financeiro/eventos-financeiros/alteracoes",
        queryTemplate: { ...DEFAULT_LIST_QUERY, data_inicio: "", data_fim: "" },
        docsUrl: "https://developers.contaazul.com/docs/financial-apis-openapi",
      },
    ],
  },
  {
    id: "pessoas",
    label: "Clientes e Pessoas",
    description:
      "Clientes, fornecedores e transportadoras com cadastro, consulta, ativação, inativação, edição e exclusão em lote.",
    defaultActionId: "list-people",
    actions: [
      {
        id: "list-people",
        label: "Listar pessoas",
        description: "Busca clientes, fornecedores e transportadoras por filtros.",
        method: "GET",
        path: "/v1/pessoas",
        queryTemplate: {
          ...DEFAULT_LIST_QUERY,
          busca: "",
          tipo_ordenacao: "nome",
          ordem_ordenacao: "ASC",
        },
        docsUrl: "https://developers.contaazul.com/open-api-docs/open-api-person",
      },
      {
        id: "create-person",
        label: "Criar pessoa",
        description: "Cria cliente, fornecedor ou transportadora na Conta Azul.",
        method: "POST",
        path: "/v1/pessoas",
        bodyTemplate: {
          nome: "",
          tipo_pessoa: "FISICA",
          perfis: ["CLIENTE"],
          cpf_cnpj: "",
          email: "",
          telefone: "",
        },
        docsUrl: "https://developers.contaazul.com/open-api-docs/open-api-person",
      },
      {
        id: "get-person",
        label: "Consultar pessoa por ID",
        description: "Obtém os dados completos de uma pessoa.",
        method: "GET",
        path: "/v1/pessoas/{id}",
        requiresId: true,
        idLabel: "ID da pessoa",
        docsUrl: "https://developers.contaazul.com/open-api-docs/open-api-person",
      },
      {
        id: "update-person",
        label: "Atualizar pessoa por ID",
        description: "Atualiza o cadastro de uma pessoa.",
        method: "PUT",
        path: "/v1/pessoas/{id}",
        requiresId: true,
        idLabel: "ID da pessoa",
        bodyTemplate: {
          nome: "",
          tipo_pessoa: "FISICA",
          perfis: ["CLIENTE"],
          cpf_cnpj: "",
          email: "",
          telefone: "",
        },
        docsUrl:
          "https://developers.contaazul.com/open-api-docs/open-api-person/v1/atualizarpessoaporid",
      },
      {
        id: "activate-people",
        label: "Ativar pessoas em lote",
        description: "Reativa uma ou mais pessoas por ID.",
        method: "POST",
        path: "/v1/pessoas/ativar",
        bodyTemplate: { ids: [] },
        docsUrl: "https://developers.contaazul.com/open-api-docs/open-api-person",
      },
      {
        id: "inactivate-people",
        label: "Inativar pessoas em lote",
        description: "Inativa clientes, fornecedores ou transportadoras em lote.",
        method: "POST",
        path: "/v1/pessoas/inativar",
        bodyTemplate: { ids: [] },
        dangerous: true,
        docsUrl:
          "https://developers.contaazul.com/open-api-docs/open-api-person/v1/desativarpessoasemlote",
      },
      {
        id: "delete-people",
        label: "Excluir pessoas em lote",
        description: "Exclui pessoas em lote quando permitido pela Conta Azul.",
        method: "POST",
        path: "/v1/pessoas/excluir",
        bodyTemplate: { ids: [] },
        dangerous: true,
        docsUrl: "https://developers.contaazul.com/open-api-docs/open-api-person",
      },
      {
        id: "connected-company",
        label: "Empresa conectada",
        description: "Retorna a empresa associada à conexão OAuth atual.",
        method: "GET",
        path: "/v1/pessoas/conta-conectada",
        docsUrl: "https://developers.contaazul.com/open-api-docs/open-api-person",
      },
    ],
  },
  {
    id: "produtos",
    label: "Produtos e Serviços",
    description:
      "Catálogo de produtos/serviços, categorias, NCM, CEST, unidades de medida e dados fiscais de inventário.",
    defaultActionId: "list-products",
    actions: [
      {
        id: "list-products",
        label: "Listar produtos",
        description: "Consulta produtos e serviços do catálogo.",
        method: "GET",
        path: "/v1/produtos",
        queryTemplate: { ...DEFAULT_LIST_QUERY, busca: "", status: "ATIVO" },
        docsUrl: "https://developers.contaazul.com/open-api-docs/open-api-inventory",
      },
      {
        id: "create-product",
        label: "Criar produto",
        description: "Cria um produto ou serviço com dados comerciais, estoque e fiscal.",
        method: "POST",
        path: "/v1/produtos",
        bodyTemplate: {
          nome: "",
          codigo_sku: "",
          status: "ATIVO",
          formato: "SIMPLES",
          valor_venda: 0,
        },
        docsUrl: "https://developers.contaazul.com/open-api-docs/open-api-inventory/v1",
      },
      {
        id: "get-product",
        label: "Consultar produto por ID",
        description: "Obtém dados completos do item de catálogo.",
        method: "GET",
        path: "/v1/produtos/{id}",
        requiresId: true,
        idLabel: "ID do produto",
        docsUrl: "https://developers.contaazul.com/open-api-docs/open-api-inventory/v1",
      },
      {
        id: "update-product",
        label: "Atualizar produto por ID",
        description: "Atualiza um item de catálogo.",
        method: "PUT",
        path: "/v1/produtos/{id}",
        requiresId: true,
        idLabel: "ID do produto",
        bodyTemplate: {
          nome: "",
          codigo_sku: "",
          status: "ATIVO",
          formato: "SIMPLES",
          valor_venda: 0,
        },
        docsUrl: "https://developers.contaazul.com/open-api-docs/open-api-inventory",
      },
      {
        id: "list-product-categories",
        label: "Categorias de produtos",
        description: "Lista categorias de produtos.",
        method: "GET",
        path: "/v1/produtos/categorias",
        docsUrl: "https://developers.contaazul.com/open-api-docs/open-api-inventory",
      },
      {
        id: "list-ncm",
        label: "Consultar NCM",
        description: "Busca códigos NCM para classificação fiscal.",
        method: "GET",
        path: "/v1/produtos/ncm",
        queryTemplate: { busca: "" },
        docsUrl: "https://developers.contaazul.com/open-api-docs/open-api-inventory",
      },
      {
        id: "list-cest",
        label: "Consultar CEST",
        description: "Busca códigos CEST.",
        method: "GET",
        path: "/v1/produtos/cest",
        queryTemplate: { busca: "" },
        docsUrl: "https://developers.contaazul.com/open-api-docs/open-api-inventory",
      },
      {
        id: "list-measure-units",
        label: "Unidades de medida",
        description: "Lista unidades de medida aceitas em produtos.",
        method: "GET",
        path: "/v1/produtos/unidades-medida",
        docsUrl: "https://developers.contaazul.com/open-api-docs/open-api-inventory",
      },
    ],
  },
  {
    id: "vendas",
    label: "Vendas",
    description:
      "Vendedores, próximo número, busca, criação, atualização, consulta, itens e exclusão em lote de vendas.",
    defaultActionId: "search-sales",
    actions: [
      {
        id: "search-sales",
        label: "Buscar vendas",
        description: "Consulta vendas por cliente, período, produto, situação e número.",
        method: "GET",
        path: "/v1/venda/busca",
        queryTemplate: { ...DEFAULT_LIST_QUERY, termo_busca: "", data_inicio: "", data_fim: "" },
        docsUrl: "https://developers.contaazul.com/docs/sales-apis-openapi/v1",
      },
      {
        id: "create-sale",
        label: "Criar venda",
        description: "Cria uma venda no ERP.",
        method: "POST",
        path: "/v1/venda",
        bodyTemplate: {
          id_cliente: "",
          numero: 0,
          situacao: "EM_ANDAMENTO",
          data_venda: "2026-07-19",
          itens: [],
        },
        docsUrl: "https://developers.contaazul.com/docs/sales-apis-openapi/v1",
      },
      {
        id: "get-sale",
        label: "Consultar venda por ID",
        description: "Obtém os dados completos de uma venda por UUID ou ID legado.",
        method: "GET",
        path: "/v1/venda/{id}",
        requiresId: true,
        idLabel: "ID ou ID legado da venda",
        docsUrl: "https://developers.contaazul.com/docs/sales-apis-openapi/v1",
      },
      {
        id: "update-sale",
        label: "Atualizar venda por ID",
        description: "Atualiza uma venda existente.",
        method: "PUT",
        path: "/v1/venda/{id}",
        requiresId: true,
        idLabel: "UUID da venda",
        bodyTemplate: {
          id_cliente: "",
          numero: 0,
          situacao: "APROVADO",
          data_venda: "2026-07-19",
          itens: [],
        },
        docsUrl: "https://developers.contaazul.com/docs/sales-apis-openapi/v1",
      },
      {
        id: "get-sale-items",
        label: "Itens da venda",
        description: "Lista os itens vinculados a uma venda.",
        method: "GET",
        path: "/v1/venda/{id_venda}/itens",
        requiresId: true,
        idLabel: "ID da venda",
        docsUrl: "https://developers.contaazul.com/docs/sales-apis-openapi/v1/getvendaitens",
      },
      {
        id: "get-next-sale-number",
        label: "Próximo número de venda",
        description: "Consulta o próximo número disponível para criar uma venda.",
        method: "GET",
        path: "/v1/venda/proximo-numero",
        docsUrl: "https://developers.contaazul.com/docs/sales-apis-openapi/v1",
      },
      {
        id: "list-sellers",
        label: "Listar vendedores",
        description: "Lista vendedores disponíveis para associação nas vendas.",
        method: "GET",
        path: "/v1/venda/vendedores",
        docsUrl: "https://developers.contaazul.com/docs/sales-apis-openapi/v1",
      },
      {
        id: "delete-sales",
        label: "Excluir vendas em lote",
        description: "Exclui vendas em lote pelo payload informado.",
        method: "POST",
        path: "/v1/venda/exclusao-lote",
        bodyTemplate: { ids: [] },
        dangerous: true,
        docsUrl: "https://developers.contaazul.com/docs/sales-apis-openapi",
      },
    ],
  },
  {
    id: "contratos",
    label: "Contratos",
    description:
      "Contratos recorrentes, próximo número, consulta, criação, encerramento e exclusão quando disponível.",
    defaultActionId: "list-contracts",
    actions: [
      {
        id: "list-contracts",
        label: "Buscar contratos",
        description: "Consulta contratos por cliente, data e busca textual.",
        method: "GET",
        path: "/v1/contratos",
        queryTemplate: { ...DEFAULT_LIST_QUERY, busca_textual: "", data_inicio: "", data_fim: "" },
        docsUrl: "https://developers.contaazul.com/docs/contracts-apis-openapi/v1",
      },
      {
        id: "create-contract",
        label: "Criar contrato",
        description: "Cria um contrato recorrente com termos, pagamento e itens.",
        method: "POST",
        path: "/v1/contratos",
        bodyTemplate: {
          id_cliente: "",
          data_emissao: "2026-07-19",
          termos: {
            tipo_frequencia: "MENSAL",
            tipo_expiracao: "DATA",
            data_inicio: "2026-07-19",
            data_fim: "2027-07-19",
            intervalo_frequencia: 1,
            dia_emissao_venda: 1,
            numero: 0,
          },
          condicao_pagamento: {
            tipo_pagamento: "BOLETO_BANCARIO",
            id_conta_financeira: "",
            dia_vencimento: 10,
            primeira_data_vencimento: "2026-08-10",
          },
          itens: [],
        },
        docsUrl: "https://developers.contaazul.com/docs/contracts-apis-openapi/v1",
      },
      {
        id: "get-contract",
        label: "Consultar contrato por ID",
        description: "Obtém um contrato por ID quando o endpoint estiver habilitado na conta.",
        method: "GET",
        path: "/v1/contratos/{id}",
        requiresId: true,
        idLabel: "ID do contrato",
        docsUrl: "https://developers.contaazul.com/docs/open-api-scheduled-sales",
      },
      {
        id: "get-next-contract-number",
        label: "Próximo número de contrato",
        description: "Consulta o próximo número disponível para criação de contrato.",
        method: "GET",
        path: "/v1/contratos/proximo-numero",
        docsUrl: "https://developers.contaazul.com/docs/contracts-apis-openapi/v1",
      },
      {
        id: "end-contract",
        label: "Encerrar contrato",
        description: "Encerra um contrato recorrente pelo ID.",
        method: "POST",
        path: "/v1/contratos/{id}/encerrar",
        requiresId: true,
        idLabel: "ID do contrato",
        bodyTemplate: { data_encerramento: "2026-07-19", motivo: "" },
        dangerous: true,
        docsUrl: "https://developers.contaazul.com/docs/open-api-scheduled-sales",
      },
      {
        id: "delete-contract",
        label: "Excluir contrato",
        description: "Exclui contrato pelo ID quando permitido.",
        method: "DELETE",
        path: "/v1/contratos/{id}",
        requiresId: true,
        idLabel: "ID do contrato",
        dangerous: true,
        docsUrl: "https://developers.contaazul.com/docs/open-api-scheduled-sales",
      },
    ],
  },
  {
    id: "cobrancas",
    label: "Cobranças",
    description: "Geração, consulta e cancelamento de cobranças de contas a receber.",
    defaultActionId: "generate-charge",
    actions: [
      {
        id: "generate-charge",
        label: "Gerar cobrança",
        description: "Cria uma cobrança para uma parcela de conta a receber.",
        method: "POST",
        path: "/v1/financeiro/eventos-financeiros/contas-a-receber/gerar-cobranca",
        bodyTemplate: {
          conta_bancaria: "",
          descricao_fatura: "",
          id_parcela: "",
          data_vencimento: "2026-07-19",
          tipo: "LINK_PAGAMENTO",
          maximo_parcelas: 1,
        },
        docsUrl: "https://developers.contaazul.com/docs/charge-apis-openapi/v1",
      },
      {
        id: "get-charge",
        label: "Consultar cobrança por ID",
        description: "Consulta status, URL e dados de uma cobrança.",
        method: "GET",
        path: "/v1/financeiro/eventos-financeiros/contas-a-receber/cobranca/{id_cobranca}",
        requiresId: true,
        idLabel: "ID da cobrança",
        docsUrl: "https://developers.contaazul.com/docs/charge-apis-openapi/v1",
      },
      {
        id: "delete-charge",
        label: "Cancelar cobrança",
        description: "Cancela uma cobrança existente.",
        method: "DELETE",
        path: "/v1/financeiro/eventos-financeiros/contas-a-receber/cobranca/{id_cobranca}",
        requiresId: true,
        idLabel: "ID da cobrança",
        dangerous: true,
        docsUrl: "https://developers.contaazul.com/docs/charge-apis-openapi/v1",
      },
    ],
  },
  {
    id: "fiscal",
    label: "Fiscal",
    description:
      "Consulta de NF-e de produto, notas de serviço quando disponíveis e vínculo MDF-e.",
    defaultActionId: "list-invoices",
    actions: [
      {
        id: "list-invoices",
        label: "Listar notas fiscais",
        description: "Consulta NF-e emitidas por data, número, documento ou venda.",
        method: "GET",
        path: "/v1/notas-fiscais",
        queryTemplate: {
          data_inicial: "2026-07-01",
          data_final: "2026-07-19",
          pagina: 1,
          tamanho_pagina: 20,
          documento_tomador: "",
          numero_nota: "",
          id_venda: "",
        },
        docsUrl: "https://developers.contaazul.com/open-api-docs/open-api-invoice",
      },
      {
        id: "get-invoice",
        label: "Consultar nota fiscal por chave",
        description: "Obtém uma nota fiscal pela chave de acesso.",
        method: "GET",
        path: "/v1/notas-fiscais/{chave}",
        requiresId: true,
        idLabel: "Chave da nota fiscal",
        docsUrl:
          "https://developers.contaazul.com/open-api-docs/open-api-invoice/v1/obternotafiscalporchave",
      },
      {
        id: "list-service-invoices",
        label: "Listar notas de serviço",
        description: "Consulta notas fiscais de serviço quando habilitado para a conta.",
        method: "GET",
        path: "/v1/notas-fiscais-servico",
        queryTemplate: {
          data_inicial: "2026-07-01",
          data_final: "2026-07-19",
          pagina: 1,
          tamanho_pagina: 20,
        },
        docsUrl: "https://developers.contaazul.com/open-api-docs/open-api-invoice",
      },
      {
        id: "link-mdfe",
        label: "Vincular MDF-e",
        description: "Registra vínculo MDF-e quando o fluxo fiscal exigir.",
        method: "POST",
        path: "/v1/notas-fiscais/vinculo-mdfe",
        bodyTemplate: { chave_nfe: "", chave_mdfe: "" },
        docsUrl: "https://developers.contaazul.com/open-api-docs/open-api-invoice",
      },
    ],
  },
  {
    id: "orcamentos",
    label: "Orçamentos",
    description: "Criação, consulta e exclusão em lote de orçamentos/propostas.",
    defaultActionId: "list-proposals",
    actions: [
      {
        id: "list-proposals",
        label: "Buscar orçamentos",
        description: "Consulta orçamentos por data, cliente, vendedor e termo de busca.",
        method: "GET",
        path: "/v1/orcamentos",
        queryTemplate: { ...DEFAULT_LIST_QUERY, termo_busca: "", data_inicio: "", data_fim: "" },
        docsUrl: "https://developers.contaazul.com/docs/open-api-proposal/v1",
      },
      {
        id: "create-proposal",
        label: "Criar orçamento",
        description: "Cria uma proposta/orçamento na Conta Azul.",
        method: "POST",
        path: "/v1/orcamentos",
        bodyTemplate: {
          data_orcamento: "2026-07-19",
          data_validade: "2026-08-02",
          id_cliente: "",
          itens: [],
        },
        docsUrl: "https://developers.contaazul.com/docs/open-api-proposal/v1",
      },
      {
        id: "get-proposal",
        label: "Consultar orçamento por ID",
        description: "Obtém um orçamento específico por ID.",
        method: "GET",
        path: "/v1/orcamentos/{id}",
        requiresId: true,
        idLabel: "ID do orçamento",
        docsUrl: "https://developers.contaazul.com/docs/open-api-proposal/v1",
      },
      {
        id: "delete-proposals",
        label: "Excluir orçamentos em lote",
        description: "Exclui até 10 orçamentos por payload.",
        method: "DELETE",
        path: "/v1/orcamentos",
        bodyTemplate: { ids: [] },
        dangerous: true,
        docsUrl: "https://developers.contaazul.com/docs/open-api-proposal/v1",
      },
    ],
  },
];

export function requireContaAzulEnv() {
  const clientId = process.env.CONTA_AZUL_CLIENT_ID;
  const clientSecret = process.env.CONTA_AZUL_CLIENT_SECRET;
  const redirectUri = process.env.CONTA_AZUL_REDIRECT_URI;
  const stateSecret = process.env.CONTA_AZUL_OAUTH_STATE_SECRET;
  const tokenEncryptionKey = process.env.CONTA_AZUL_TOKEN_ENCRYPTION_KEY;

  if (!clientId || !clientSecret || !redirectUri || !stateSecret || !tokenEncryptionKey) {
    throw new Error(
      "Integração Conta Azul não configurada. Configure CONTA_AZUL_CLIENT_ID, CONTA_AZUL_CLIENT_SECRET, CONTA_AZUL_REDIRECT_URI, CONTA_AZUL_OAUTH_STATE_SECRET e CONTA_AZUL_TOKEN_ENCRYPTION_KEY nos secrets.",
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    stateSecret,
    tokenEncryptionKey,
    apiBaseUrl: withoutTrailingSlash(process.env.CONTA_AZUL_API_BASE_URL || DEFAULT_API_BASE_URL),
    authBaseUrl: withoutTrailingSlash(
      process.env.CONTA_AZUL_AUTH_BASE_URL || DEFAULT_AUTH_BASE_URL,
    ),
  };
}

export function signContaAzulState(userId: string, origin: string, secret: string): string {
  const payload = { u: userId, o: origin, t: Date.now() };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyContaAzulState(
  state: string,
  secret: string,
): { userId: string; origin: string } | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;

  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const actualBuffer = Buffer.from(sig);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (Date.now() - payload.t > 15 * 60 * 1000) return null;
    if (typeof payload.u !== "string" || typeof payload.o !== "string") return null;
    return { userId: payload.u, origin: payload.o };
  } catch {
    return null;
  }
}

export function buildContaAzulAuthUrl(state: string): string {
  const { authBaseUrl, clientId, redirectUri } = requireContaAzulEnv();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: CONTA_AZUL_SCOPE,
  });

  return `${authBaseUrl}/login?${params.toString()}`;
}

export async function exchangeContaAzulCodeForTokens(code: string): Promise<ContaAzulTokenPayload> {
  const { redirectUri } = requireContaAzulEnv();
  return requestContaAzulToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
}

export async function storeContaAzulTokens(userId: string, tokens: ContaAzulTokenPayload) {
  if (!tokens.refresh_token) {
    throw new Error("A Conta Azul não retornou refresh_token. Refaça a autorização.");
  }

  await persistContaAzulTokens({
    connectedBy: userId,
    tokenSet: tokens,
    refreshToken: tokens.refresh_token,
    identity: decodeContaAzulIdentity(tokens.id_token),
  });
}

export async function getContaAzulSafeStatus(): Promise<ContaAzulSafeStatus> {
  const result = await getValidContaAzulAccessToken();
  if (result.status === "connected") {
    const { accessToken: _accessToken, ...safe } = result;
    return safe;
  }

  return result;
}

export async function listContaAzulCategorias() {
  try {
    const data = await requestContaAzul<unknown>("/v1/categorias");
    const normalized = normalizeContaAzulList(data);
    return {
      needsAuth: false as const,
      status: "connected" as const,
      categorias: normalized.items,
      responseShape: describeContaAzulResponse(data),
      listSource: normalized.source,
    };
  } catch (error) {
    if (error instanceof ContaAzulConnectionUnavailableError) {
      return {
        needsAuth: true as const,
        status: error.result.status,
        categorias: [],
        responseShape: null,
        listSource: null,
      };
    }
    throw error;
  }
}

export function getContaAzulBackofficeModules(): ContaAzulBackofficeModule[] {
  const modules = cloneStructured(CONTA_AZUL_BACKOFFICE_MODULES);
  // Datas preenchidas por requisicao: em Cloudflare Workers, new Date() avaliado
  // no carregamento do modulo retorna a epoca zero (1970-01-01).
  for (const module of modules) {
    for (const action of module.actions) {
      const query = action.queryTemplate;
      if (query && "data_vencimento_de" in query) {
        query.data_vencimento_de = monthStartISO();
        query.data_vencimento_ate = monthEndISO();
      }
    }
  }
  return modules;
}

export async function runContaAzulOperation(
  input: ContaAzulOperationInput,
): Promise<ContaAzulOperationResult> {
  const { module, action } = getContaAzulAction(input.moduleId, input.actionId);
  const request = buildContaAzulOperationRequest(input);
  const data = await requestContaAzul<ContaAzulJsonValue>(request.path, {
    method: action.method,
    body: request.body,
  });
  const normalized = normalizeContaAzulList(data);

  return {
    ok: true,
    moduleId: module.id,
    actionId: action.id,
    method: action.method,
    path: request.path,
    performedAt: new Date().toISOString(),
    responseShape: describeContaAzulResponse(data),
    listSource: normalized.source,
    itemCount: normalized.items.length,
    items: normalized.items as ContaAzulJsonValue[],
    data,
  };
}

export function buildContaAzulOperationRequest(input: ContaAzulOperationInput): {
  method: ContaAzulHttpMethod;
  path: string;
  body?: string;
} {
  const { action } = getContaAzulAction(input.moduleId, input.actionId);
  const path = appendQueryString(
    interpolateContaAzulPath(action.path, input.id, action.requiresId),
    input.query,
  );
  const shouldSendBody =
    action.method !== "GET" &&
    input.body !== undefined &&
    input.body !== null &&
    !isEmptyRecord(input.body);

  return {
    method: action.method,
    path,
    body: shouldSendBody ? JSON.stringify(input.body) : undefined,
  };
}

export async function disconnectContaAzulConnection() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await contaAzulTokensTable(supabaseAdmin).delete().eq("id", SYSTEM_CONNECTION_ID);
}

export async function requestContaAzul<T>(path: string, init: RequestInit = {}): Promise<T> {
  const tokenResult = await getValidContaAzulAccessToken();
  if (tokenResult.status !== "connected") {
    throw new ContaAzulConnectionUnavailableError(tokenResult);
  }

  let response = await fetchContaAzulWithBearer(path, init, tokenResult.accessToken);

  if (response.status === 401) {
    const refreshed = await getValidContaAzulAccessToken({ forceRefresh: true });
    if (refreshed.status !== "connected") {
      throw new ContaAzulConnectionUnavailableError(refreshed);
    }
    response = await fetchContaAzulWithBearer(path, init, refreshed.accessToken);
  }

  if (!response.ok) {
    const errorBody = await readContaAzulBody(response);
    throw new Error(
      `Conta Azul API retornou HTTP ${response.status}${formatContaAzulErrorBody(errorBody)}.`,
    );
  }

  return (await readContaAzulBody(response)) as T;
}

async function getValidContaAzulAccessToken(
  options: { forceRefresh?: boolean } = {},
): Promise<ContaAzulAccessTokenResult> {
  const row = await getContaAzulTokenRow();
  if (!row) return { status: "disconnected", reason: "not_connected" };

  const expiresAt = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0;
  if (
    !options.forceRefresh &&
    row.status === "connected" &&
    row.access_token_ciphertext &&
    expiresAt > Date.now() + TOKEN_REFRESH_MARGIN_MS
  ) {
    return {
      status: "connected",
      accessToken: decryptContaAzulSecret(row.access_token_ciphertext),
      connectedAt: row.created_at,
      connectedBy: row.connected_by,
      identity: row.conta_azul_identity,
      tokenExpiresAt: row.token_expires_at,
      lastError: row.last_error,
    };
  }

  try {
    const refreshToken = decryptContaAzulSecret(row.refresh_token_ciphertext);
    const refreshed = await requestContaAzulToken({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
    await persistContaAzulTokens({
      connectedBy: row.connected_by,
      tokenSet: refreshed,
      refreshToken: refreshed.refresh_token || refreshToken,
      identity: row.conta_azul_identity,
    });

    const updated = await getContaAzulTokenRow();
    return {
      status: "connected",
      accessToken: refreshed.access_token,
      connectedAt: updated?.created_at || row.created_at,
      connectedBy: updated?.connected_by || row.connected_by,
      identity: updated?.conta_azul_identity || row.conta_azul_identity,
      tokenExpiresAt: updated?.token_expires_at || null,
      lastError: null,
    };
  } catch (error) {
    if (
      error instanceof ContaAzulTokenEndpointError &&
      (error.code === "invalid_grant" || error.code === "invalid_client")
    ) {
      await markContaAzulTokenStatus("needs_reconnect", error.code);
      return { status: "needs_reconnect", reason: error.code, lastError: error.code };
    }

    await markContaAzulTokenStatus("error", "conta_azul_unavailable");
    return { status: "temporarily_unavailable", reason: "conta_azul_unavailable" };
  }
}

async function requestContaAzulToken(
  params: Record<string, string>,
): Promise<ContaAzulTokenPayload> {
  const { authBaseUrl, clientId, clientSecret } = requireContaAzulEnv();
  const response = await fetch(`${authBaseUrl}/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(params),
  });

  const payload = await readContaAzulJson(response);
  if (!response.ok) {
    const code = getErrorCode(payload);
    throw new ContaAzulTokenEndpointError(
      `Conta Azul token endpoint returned HTTP ${response.status}.`,
      response.status,
      code,
    );
  }

  if (!payload || typeof payload !== "object" || !("access_token" in payload)) {
    throw new Error("Resposta de token da Conta Azul inválida.");
  }

  return payload as ContaAzulTokenPayload;
}

async function persistContaAzulTokens(input: {
  connectedBy: string | null;
  tokenSet: ContaAzulTokenPayload;
  refreshToken: string;
  identity: Record<string, unknown> | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const expiresIn = input.tokenSet.expires_in || DEFAULT_ACCESS_TOKEN_TTL_SECONDS;
  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const { error } = await contaAzulTokensTable(supabaseAdmin).upsert({
    id: SYSTEM_CONNECTION_ID,
    connected_by: input.connectedBy,
    conta_azul_identity: input.identity,
    access_token_ciphertext: encryptContaAzulSecret(input.tokenSet.access_token),
    refresh_token_ciphertext: encryptContaAzulSecret(input.refreshToken),
    token_expires_at: tokenExpiresAt,
    scope: input.tokenSet.scope || null,
    token_type: input.tokenSet.token_type || null,
    status: "connected",
    last_error: null,
  });

  if (error) throw error;
}

async function getContaAzulTokenRow(): Promise<ContaAzulTokenRow | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await contaAzulTokensTable(supabaseAdmin)
    .select("*")
    .eq("id", SYSTEM_CONNECTION_ID)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function markContaAzulTokenStatus(status: "needs_reconnect" | "error", lastError: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await contaAzulTokensTable(supabaseAdmin)
    .update({ status, last_error: lastError })
    .eq("id", SYSTEM_CONNECTION_ID);
}

function contaAzulTokensTable(supabaseAdmin: unknown): ContaAzulTokensTable {
  return (supabaseAdmin as { from(table: string): ContaAzulTokensTable }).from(
    "conta_azul_oauth_tokens",
  );
}

async function fetchContaAzulWithBearer(path: string, init: RequestInit, accessToken: string) {
  const { apiBaseUrl } = requireContaAzulEnv();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetchWith429Backoff(new URL(path.replace(/^\//, ""), `${apiBaseUrl}/`).toString(), {
    ...init,
    headers,
  });
}

async function fetchWith429Backoff(url: string, init: RequestInit) {
  for (let attempt = 0; attempt <= 4; attempt += 1) {
    const response = await fetch(url, init);
    if (response.status !== 429 || attempt === 4) {
      return response;
    }

    const retryAfterMs = parseRetryAfter(response.headers.get("Retry-After"));
    const exponentialDelay = Math.min(8_000, 500 * 2 ** attempt);
    const jitter = Math.floor(Math.random() * 150);
    await delay(retryAfterMs ?? exponentialDelay + jitter);
  }

  throw new Error("Falha inesperada no backoff da Conta Azul.");
}

async function readContaAzulJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function readContaAzulBody(response: Response): Promise<ContaAzulJsonValue> {
  if (response.status === 204 || response.status === 205) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json") || contentType.includes("+json")) {
    const payload = await readContaAzulJson(response);
    return isContaAzulJsonValue(payload) ? payload : null;
  }

  if (contentType.includes("application/pdf") || contentType.startsWith("image/")) {
    const bytes = Buffer.from(await response.arrayBuffer());
    return {
      content_type: contentType,
      byte_length: bytes.byteLength,
      base64: bytes.toString("base64"),
    };
  }

  const text = await response.text();
  return text || null;
}

function encryptContaAzulSecret(value: string): string {
  const key = getTokenEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return ["v1", iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(
    ".",
  );
}

function decryptContaAzulSecret(value: string): string {
  const [version, ivBase64, tagBase64, ciphertextBase64] = value.split(".");
  if (version !== "v1" || !ivBase64 || !tagBase64 || !ciphertextBase64) {
    throw new Error("Token cifrado da Conta Azul inválido.");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getTokenEncryptionKey(),
    Buffer.from(ivBase64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagBase64, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextBase64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function getTokenEncryptionKey(): Buffer {
  const { tokenEncryptionKey } = requireContaAzulEnv();
  const key = Buffer.from(tokenEncryptionKey, "base64");
  if (key.length !== 32) {
    throw new Error("CONTA_AZUL_TOKEN_ENCRYPTION_KEY precisa ter 32 bytes em base64.");
  }
  return key;
}

function decodeContaAzulIdentity(idToken?: string): Record<string, unknown> | null {
  if (!idToken) return null;

  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"));
    return {
      sub: payload.sub || null,
      email: payload.email || null,
      name: payload.name || payload.given_name || null,
    };
  } catch {
    return null;
  }
}

function normalizeContaAzulList(value: unknown): {
  items: Record<string, unknown>[];
  source: string | null;
} {
  if (Array.isArray(value)) {
    return { items: value.filter(isRecord), source: "root" };
  }

  if (isRecord(value)) {
    const listKeys = [
      "items",
      "item",
      "data",
      "content",
      "contents",
      "results",
      "result",
      "categorias",
      "categoria",
      "categories",
      "records",
      "itens",
      "lista",
    ];

    for (const key of listKeys) {
      const candidate = value[key];
      if (Array.isArray(candidate)) {
        return { items: candidate.filter(isRecord), source: key };
      }
    }

    for (const [key, candidate] of Object.entries(value)) {
      if (Array.isArray(candidate) && candidate.some(isRecord)) {
        return { items: candidate.filter(isRecord), source: key };
      }
    }

    const recordValues = Object.values(value).filter(isRecord);
    if (recordValues.length > 1) {
      return { items: recordValues, source: "objectValues" };
    }
  }

  return { items: [], source: null };
}

function describeContaAzulResponse(value: unknown): string {
  if (Array.isArray(value)) {
    return `array(${value.length})`;
  }

  if (isRecord(value)) {
    return `object(${Object.keys(value).slice(0, 12).join(", ")})`;
  }

  return value === null ? "null" : typeof value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getErrorCode(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const error = (payload as { error?: unknown }).error;
  return typeof error === "string" ? error : null;
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - Date.now()) : null;
}

function getContaAzulAction(moduleId: string, actionId: string) {
  const module = CONTA_AZUL_BACKOFFICE_MODULES.find((m) => m.id === moduleId);
  if (!module) throw new Error("Módulo da Conta Azul inválido.");

  const action = module.actions.find((a) => a.id === actionId);
  if (!action) throw new Error("Operação da Conta Azul inválida.");

  return { module, action };
}

function interpolateContaAzulPath(path: string, id: string | undefined, requiresId?: boolean) {
  if (!path.includes("{")) return path;

  const cleanId = id?.trim();
  if (requiresId && !cleanId) {
    throw new Error("Informe o ID exigido por esta operação da Conta Azul.");
  }

  return path.replace(/\{[^}]+\}/g, () => encodeURIComponent(cleanId || ""));
}

function appendQueryString(path: string, query: ContaAzulJsonRecord | undefined) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query || {})) {
    appendQueryParam(params, key, value);
  }

  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}

function appendQueryParam(params: URLSearchParams, key: string, value: ContaAzulJsonValue) {
  if (value === null || value === "") return;

  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
        params.append(key, String(item));
      }
    }
    return;
  }

  if (typeof value === "object") return;
  params.append(key, String(value));
}

function isEmptyRecord(value: ContaAzulJsonValue): boolean {
  return isRecord(value) && Object.keys(value).length === 0;
}

function formatContaAzulErrorBody(value: ContaAzulJsonValue): string {
  if (value === null) return "";

  if (typeof value === "string") {
    return value.trim() ? `: ${value.slice(0, 600)}` : "";
  }

  return `: ${JSON.stringify(value).slice(0, 900)}`;
}

function isContaAzulJsonValue(value: unknown): value is ContaAzulJsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isContaAzulJsonValue);
  }

  if (isRecord(value)) {
    return Object.values(value).every(isContaAzulJsonValue);
  }

  return false;
}

function cloneStructured<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Contas a pagar: leitura amigavel -------------------------------------
// A Conta Azul nao documenta o formato exato de cada campo e ja mudou nomes
// entre versoes (o modulo de categorias precisou do mesmo tratamento). Por isso
// a leitura tenta uma lista de nomes candidatos em vez de fixar uma chave so.

export type ContaAPagarRow = {
  id: string | null;
  descricao: string;
  fornecedor: string | null;
  vencimento: string | null;
  valor: number | null;
  pago: boolean;
  statusLabel: string | null;
};

function pickString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    // Campos como "contato" costumam vir aninhados: { id, nome }.
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nome = (value as Record<string, unknown>).nome;
      if (typeof nome === "string" && nome.trim()) return nome.trim();
    }
  }
  return null;
}

function pickNumber(row: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      // Aceita "1.234,56" (BR) e "1234.56" (ISO).
      const brl = /,\d{1,2}$/.test(value.trim());
      const cleaned = brl
        ? value
            .replace(/[^\d,-]/g, "")
            .replace(/\./g, "")
            .replace(",", ".")
        : value.replace(/[^\d.-]/g, "");
      const parsed = Number(cleaned);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

export function toISODateCA(value: string | null): string | null {
  if (!value) return null;
  const s = value.trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  return null;
}

export function isPagoStatus(status: string | null): boolean {
  if (!status) return false;
  return /pag|quitad|liquidad|baixad/i.test(status);
}

export function normalizeContaAPagar(row: Record<string, unknown>): ContaAPagarRow {
  const status = pickString(row, ["status", "situacao", "situacao_pagamento", "status_pagamento"]);
  return {
    id: pickString(row, ["id", "uuid", "id_evento", "id_evento_financeiro", "codigo"]),
    descricao:
      pickString(row, ["descricao", "description", "observacao", "nome"]) ?? "Sem descrição",
    fornecedor: pickString(row, ["contato", "fornecedor", "pessoa", "cliente", "nome_contato"]),
    vencimento: toISODateCA(
      pickString(row, ["data_vencimento", "vencimento", "data_vencimento_parcela", "data"]),
    ),
    valor: pickNumber(row, ["valor", "valor_total", "valor_parcela", "total", "valor_liquido"]),
    pago: isPagoStatus(status),
    statusLabel: status,
  };
}
