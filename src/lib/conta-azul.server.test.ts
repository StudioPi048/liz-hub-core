import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildContaAzulAuthUrl,
  signContaAzulState,
  verifyContaAzulState,
} from "./conta-azul.server";

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
});
