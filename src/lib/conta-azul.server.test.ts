import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildContaAzulAuthUrl,
  buildContaAzulOperationRequest,
  getContaAzulBackofficeModules,
  isPagoStatus,
  normalizeContaAPagar,
  signContaAzulState,
  toISODateCA,
  verifyContaAzulState,
} from "./conta-azul.server";

describe("Contas a pagar: leitura tolerante de campos", () => {
  it("normaliza datas ISO, ISO com hora e formato BR", () => {
    expect(toISODateCA("2026-07-19")).toBe("2026-07-19");
    expect(toISODateCA("2026-07-19T00:00:00Z")).toBe("2026-07-19");
    expect(toISODateCA("19/07/2026")).toBe("2026-07-19");
    expect(toISODateCA("5/7/2026")).toBe("2026-07-05");
    expect(toISODateCA(null)).toBeNull();
    expect(toISODateCA("sem data")).toBeNull();
  });

  it("reconhece status de pago em variacoes da Conta Azul", () => {
    expect(isPagoStatus("PAGO")).toBe(true);
    expect(isPagoStatus("Quitado")).toBe(true);
    expect(isPagoStatus("LIQUIDADO")).toBe(true);
    expect(isPagoStatus("EM_ABERTO")).toBe(false);
    expect(isPagoStatus(null)).toBe(false);
  });

  it("le uma conta a pagar com nomes de campo diretos", () => {
    const conta = normalizeContaAPagar({
      id: "abc-1",
      descricao: "Aluguel da sala",
      contato: { id: "f1", nome: "Imobiliária Central" },
      data_vencimento: "2026-07-25",
      valor: 3200.5,
      status: "EM_ABERTO",
    });

    expect(conta).toMatchObject({
      id: "abc-1",
      descricao: "Aluguel da sala",
      fornecedor: "Imobiliária Central",
      vencimento: "2026-07-25",
      valor: 3200.5,
      pago: false,
    });
  });

  it("cai para nomes alternativos e valor em formato BR", () => {
    const conta = normalizeContaAPagar({
      uuid: "xyz-9",
      observacao: "Energia elétrica",
      fornecedor: "Celesc",
      vencimento: "01/08/2026",
      valor_total: "1.234,56",
      situacao: "PAGO",
    });

    expect(conta).toMatchObject({
      id: "xyz-9",
      descricao: "Energia elétrica",
      fornecedor: "Celesc",
      vencimento: "2026-08-01",
      valor: 1234.56,
      pago: true,
    });
  });

  it("nao quebra quando a Conta Azul manda um objeto sem os campos esperados", () => {
    const conta = normalizeContaAPagar({ algo: "inesperado" });
    expect(conta.descricao).toBe("Sem descrição");
    expect(conta.valor).toBeNull();
    expect(conta.vencimento).toBeNull();
    expect(conta.pago).toBe(false);
  });
});

describe("Conta Azul OAuth helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("signs and verifies OAuth state with origin and user id", () => {
    vi.setSystemTime(new Date("2026-07-19T12:00:00.000Z"));

    const state = signContaAzulState("user-123", "https://liz.example", "state-secret");

    expect(verifyContaAzulState(state, "state-secret")).toEqual({
      userId: "user-123",
      origin: "https://liz.example",
    });
    expect(verifyContaAzulState(state, "wrong-secret")).toBeNull();
  });

  it("rejects expired OAuth state", () => {
    vi.setSystemTime(new Date("2026-07-19T12:00:00.000Z"));
    const state = signContaAzulState("user-123", "https://liz.example", "state-secret");

    vi.setSystemTime(new Date("2026-07-19T12:16:00.000Z"));

    expect(verifyContaAzulState(state, "state-secret")).toBeNull();
  });

  it("builds the Conta Azul authorization URL from environment variables", () => {
    vi.stubEnv("CONTA_AZUL_CLIENT_ID", "client-id");
    vi.stubEnv("CONTA_AZUL_CLIENT_SECRET", "client-secret");
    vi.stubEnv("CONTA_AZUL_REDIRECT_URI", "https://liz.example/api/public/conta-azul/callback");
    vi.stubEnv("CONTA_AZUL_OAUTH_STATE_SECRET", "state-secret");
    vi.stubEnv(
      "CONTA_AZUL_TOKEN_ENCRYPTION_KEY",
      Buffer.from("0123456789abcdef0123456789abcdef").toString("base64"),
    );

    const url = new URL(buildContaAzulAuthUrl("signed-state"));

    expect(url.origin + url.pathname).toBe("https://auth.contaazul.com/login");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://liz.example/api/public/conta-azul/callback",
    );
    expect(url.searchParams.get("state")).toBe("signed-state");
    expect(url.searchParams.get("scope")).toBe("openid profile aws.cognito.signin.user.admin");
  });

  it("exposes an operational backoffice catalog", () => {
    const modules = getContaAzulBackofficeModules();

    expect(modules.map((module) => module.id)).toEqual([
      "financeiro",
      "pessoas",
      "produtos",
      "vendas",
      "contratos",
      "cobrancas",
      "fiscal",
      "orcamentos",
    ]);
    expect(modules.flatMap((module) => module.actions).length).toBeGreaterThan(30);
  });

  it("builds Conta Azul operation requests with path params and query arrays", () => {
    const request = buildContaAzulOperationRequest({
      moduleId: "financeiro",
      actionId: "get-financial-account-balance",
      id: "conta 123",
      query: {
        pagina: 1,
        status: ["ATRASADO", "EM_ABERTO"],
        busca: "",
        apenas_ativo: true,
      },
    });

    expect(request).toEqual({
      method: "GET",
      path: "/v1/conta-financeira/conta%20123/saldo-atual?pagina=1&status=ATRASADO&status=EM_ABERTO&apenas_ativo=true",
      body: undefined,
    });
  });

  it("serializes JSON bodies for write operations", () => {
    const request = buildContaAzulOperationRequest({
      moduleId: "financeiro",
      actionId: "create-cost-center",
      body: { codigo: "1040", nome: "Contabilidade" },
    });

    expect(request).toEqual({
      method: "POST",
      path: "/v1/centro-de-custo",
      body: JSON.stringify({ codigo: "1040", nome: "Contabilidade" }),
    });
  });

  it("requires path ids for operations that declare an id placeholder", () => {
    expect(() =>
      buildContaAzulOperationRequest({
        moduleId: "vendas",
        actionId: "get-sale",
        id: "",
      }),
    ).toThrow("Informe o ID exigido");
  });
});
