import crypto from "node:crypto";

const DEFAULT_API_BASE_URL = "https://api-v2.contaazul.com";
const DEFAULT_AUTH_BASE_URL = "https://auth.contaazul.com";
const CONTA_AZUL_SCOPE = "openid profile aws.cognito.signin.user.admin";
const TOKEN_REFRESH_MARGIN_MS = 60_000;
const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 3600;
const SYSTEM_CONNECTION_ID = "system";

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
    return {
      needsAuth: false as const,
      status: "connected" as const,
      categorias: normalizeContaAzulList(data),
    };
  } catch (error) {
    if (error instanceof ContaAzulConnectionUnavailableError) {
      return { needsAuth: true as const, status: error.result.status, categorias: [] };
    }
    throw error;
  }
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
    throw new Error(`Conta Azul API retornou HTTP ${response.status}.`);
  }

  return (await response.json()) as T;
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

function normalizeContaAzulList(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  if (isRecord(value)) {
    const candidate = value.items || value.data || value.categorias;
    if (Array.isArray(candidate)) {
      return candidate.filter(isRecord);
    }
  }

  return [];
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

function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
