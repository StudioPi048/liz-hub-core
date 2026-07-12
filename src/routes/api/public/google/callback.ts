import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const err = url.searchParams.get("error");
        if (err) return redirectHtml(`/agenda?google_error=${encodeURIComponent(err)}`);
        if (!code || !state) return redirectHtml(`/agenda?google_error=missing_params`);

        try {
          const {
            requireGoogleEnv, verifyState, exchangeCodeForTokens, decodeIdTokenEmail,
          } = await import("@/lib/google-calendar.server");
          const { stateSecret } = requireGoogleEnv();
          const parsed = verifyState(state, stateSecret);
          if (!parsed) return redirectHtml(`/agenda?google_error=invalid_state`);

          const tokens = await exchangeCodeForTokens(code, parsed.origin);
          if (!tokens.refresh_token) {
            return redirectHtml(`/agenda?google_error=no_refresh_token`);
          }
          const googleEmail = decodeIdTokenEmail(tokens.id_token);
          const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.from("google_oauth_tokens").upsert({
            user_id: parsed.userId,
            google_email: googleEmail,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_expires_at: expiresAt,
            scope: tokens.scope,
          });

          return redirectHtml(`/agenda?google_connected=1`);
        } catch (e: any) {
          console.error("Google callback error", e);
          return redirectHtml(`/agenda?google_error=${encodeURIComponent(e.message || "unknown")}`);
        }
      },
    },
  },
});

function redirectHtml(path: string) {
  return new Response(
    `<!doctype html><meta http-equiv="refresh" content="0;url=${path}"><script>location.replace(${JSON.stringify(path)})</script>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
