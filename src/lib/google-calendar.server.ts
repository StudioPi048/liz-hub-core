import crypto from "node:crypto";

const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

export function requireGoogleEnv() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  const stateSecret = process.env.GOOGLE_OAUTH_STATE_SECRET;
  if (!clientId || !clientSecret || !stateSecret) {
    throw new Error(
      "Integração Google não configurada. Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET nos secrets.",
    );
  }
  return { clientId, clientSecret, stateSecret };
}

export function signState(userId: string, origin: string, secret: string): string {
  const payload = { u: userId, o: origin, t: Date.now() };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(
  state: string,
  secret: string,
): { userId: string; origin: string } | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (Date.now() - payload.t > 15 * 60 * 1000) return null;
    return { userId: payload.u, origin: payload.o };
  } catch {
    return null;
  }
}

export function buildGoogleAuthUrl(origin: string, state: string, clientId: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/public/google/callback`,
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, origin: string) {
  const { clientId, clientSecret } = requireGoogleEnv();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${origin}/api/public/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
    id_token?: string;
  };
}

export async function refreshAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = requireGoogleEnv();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {}
    const err = new Error(`Google token refresh failed: ${res.status} ${text}`);
    (err as any).response = { data, status: res.status };
    throw err;
  }
  return (await res.json()) as { access_token: string; expires_in: number; scope: string };
}

export function decodeIdTokenEmail(idToken?: string): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"));
    return payload.email || null;
  } catch {
    return null;
  }
}

export type GoogleAccessTokenResult =
  | { status: "connected"; accessToken: string; googleEmail: string | null; ownerUserId: string }
  | { status: "disconnected"; reason: "not_connected" }
  | { status: "needs_reconnect"; reason: "invalid_client" | "invalid_grant" }
  | { status: "temporarily_unavailable"; reason: "network_error" | "google_unavailable" };

export async function getValidAccessToken(
  _userId?: string, // Ignored: System-wide integration (Instituto LIZ)
): Promise<GoogleAccessTokenResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("google_oauth_tokens")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (!row) return { status: "disconnected", reason: "not_connected" };
  const expiresAt = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0;
  if (row.access_token && expiresAt > Date.now() + 60_000) {
    return {
      status: "connected",
      accessToken: row.access_token,
      googleEmail: row.google_email,
      ownerUserId: row.user_id,
    };
  }
  let refreshed;
  try {
    refreshed = await refreshAccessToken(row.refresh_token);
  } catch (e: any) {
    const errorData = e.response?.data?.error;
    if (errorData === "invalid_grant" || errorData === "invalid_client") {
      await supabaseAdmin.from("google_oauth_tokens").delete().eq("user_id", row.user_id);
      // Audit log
      console.log(
        JSON.stringify({
          event: "google_integration_removed",
          user_id: row.user_id,
          reason: errorData,
          date: new Date().toISOString(),
        }),
      );
      return { status: "needs_reconnect", reason: errorData as "invalid_grant" | "invalid_client" };
    }
    return { status: "temporarily_unavailable", reason: "google_unavailable" };
  }
  const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await supabaseAdmin
    .from("google_oauth_tokens")
    .update({
      access_token: refreshed.access_token,
      token_expires_at: newExpiry,
      scope: refreshed.scope,
    })
    .eq("user_id", row.user_id);
  return {
    status: "connected",
    accessToken: refreshed.access_token,
    googleEmail: row.google_email,
    ownerUserId: row.user_id,
  };
}

export async function fetchCalendarList(accessToken: string) {
  const res = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Calendar list failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { items: any[] };
  return data.items || [];
}

export async function fetchEventsForCalendar(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string,
) {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
  });
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    console.error(`Events fetch failed for ${calendarId}: ${res.status}`);
    return [];
  }
  const data = (await res.json()) as { items: any[] };
  return data.items || [];
}
