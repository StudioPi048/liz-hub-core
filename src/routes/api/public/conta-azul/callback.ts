import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/conta-azul/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const err = url.searchParams.get("error");

        if (err) return redirectHtml(`/financeiro?conta_azul_error=${encodeURIComponent(err)}`);
        if (!code || !state) return redirectHtml("/financeiro?conta_azul_error=missing_params");

        try {
          const {
            requireContaAzulEnv,
            verifyContaAzulState,
            exchangeContaAzulCodeForTokens,
            storeContaAzulTokens,
          } = await import("@/lib/conta-azul.server");
          const { stateSecret } = requireContaAzulEnv();
          const parsed = verifyContaAzulState(state, stateSecret);
          if (!parsed) return redirectHtml("/financeiro?conta_azul_error=invalid_state");

          const tokens = await exchangeContaAzulCodeForTokens(code);
          await storeContaAzulTokens(parsed.userId, tokens);

          return redirectHtml("/financeiro?conta_azul_connected=1");
        } catch (e) {
          const message = e instanceof Error ? e.message : "unknown";
          return redirectHtml(`/financeiro?conta_azul_error=${encodeURIComponent(message)}`);
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
