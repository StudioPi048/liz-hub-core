import { createFileRoute } from "@tanstack/react-router";
import crypto from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export const Route = createFileRoute("/api/public/webhooks/hotmart")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const hottok = request.headers.get("x-hotmart-hottok");
        const secret = process.env.HOTMART_WEBHOOK_SECRET;

        if (!secret || !hottok || !safeEqual(hottok, secret)) {
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

        const data = payload?.data ?? payload;
        const buyer = data?.buyer;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { getHotmartProductDetails } = await import("@/lib/hotmart.server");

        console.log(`Enriching Hotmart product details for ID: ${product.id}...`);
        const details = await getHotmartProductDetails(product.id);

        const metadata: Record<string, any> = { source: "hotmart_webhook_purchase" };

        if (details) {
          if (details.ucb) metadata.cover_image = details.ucb;
          if (details.description) metadata.hotmart_description = details.description;
        }

        const { error } = await (supabaseAdmin as any)
          .from("knowledge_nodes")
          .upsert(
            {
              title: details?.name || product.name,
              slug: `produto-${product.id}`,
              type: "product",
              status: "approved",
              visibility: "public",
              source_type: "hotmart",
              source_id: String(product.id),
              content: details?.description || `Produto importado. ID: ${product.id}`,
              metadata: metadata,
              authority_level: "official",
            },
            { onConflict: "slug" },
          )
          .select()
          .single();

        if (error) {
          console.error("[hotmart-webhook] upsert failed", error);
          return new Response("Internal error", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
