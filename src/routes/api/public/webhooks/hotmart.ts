import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/hotmart")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const hottok = request.headers.get("x-hotmart-hottok");
        const secret = process.env.HOTMART_WEBHOOK_SECRET;

        if (!secret || !hottok || hottok !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const event = payload?.event;
        if (event !== "PURCHASE_APPROVED") {
          return new Response("ok", { status: 200 });
        }

        const product = payload?.data?.product ?? payload?.product;
        if (!product?.id || !product?.name) {
          return new Response("ok", { status: 200 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const slug = `produto-${product.id}`;
        const record = {
          title: String(product.name),
          slug,
          type: "product",
          status: "approved",
          visibility: "public",
          source_type: "hotmart",
          source_id: String(product.id),
          authority_level: "official",
        };

        const { error } = await (supabaseAdmin as any)
          .from("knowledge_nodes")
          .upsert(record, { onConflict: "slug" });

        if (error) {
          console.error("[hotmart-webhook] upsert failed", error);
          return new Response("Internal error", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
