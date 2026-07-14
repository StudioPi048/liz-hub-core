import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

interface HotmartProduct {
  id: number | string;
  name: string;
  description?: string;
  ucb?: string;
  status?: string;
}

export const syncHotmartCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // Authorize: only admin/editor can trigger sync
      const { data: roles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId);
      const isAllowed = roles?.some((r) => r.role === "admin" || r.role === "editor");
      if (!isAllowed) {
        return { error: "Apenas admins ou editores podem sincronizar o catálogo Hotmart." };
      }

      const { authenticateHotmart, getHotmartProductDetails } = await import("@/lib/hotmart.server");
      const token = await authenticateHotmart();
      if (!token) {
        return { error: "Falha ao autenticar com a Hotmart. Verifique as credenciais." };
      }

      // Paginate through the products listing
      const allProducts: HotmartProduct[] = [];
      let pageToken: string | undefined = undefined;
      let safety = 0;

      do {
        const url = new URL("https://developers.hotmart.com/products/api/v1/products");
        url.searchParams.set("max_results", "50");
        if (pageToken) url.searchParams.set("page_token", pageToken);

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          redirect: "manual",
        });
        const raw = await res.text();
        if (!res.ok || res.status >= 300) {
          console.error("[hotmart-sync] HTTP", res.status, raw.slice(0, 300));
          return {
            error: `Hotmart API retornou ${res.status}. Resposta: ${raw.slice(0, 200)}`,
          };
        }
        let json: { items?: HotmartProduct[]; page_info?: { next_page_token?: string } };
        try {
          json = JSON.parse(raw);
        } catch {
          console.error("[hotmart-sync] resposta não-JSON", raw.slice(0, 300));
          return {
            error: `Hotmart devolveu conteúdo não-JSON. Prévia: ${raw.slice(0, 200)}`,
          };
        }
        if (Array.isArray(json.items)) allProducts.push(...json.items);
        pageToken = json.page_info?.next_page_token;
        safety += 1;
      } while (pageToken && safety < 20);

      let created = 0;
      let updated = 0;
      let failed = 0;

      const { createHash } = await import("crypto");

      for (const product of allProducts) {
        if (!product?.id || !product?.name) continue;
        const slug = `produto-${product.id}`;
        const content = product.description || "Produto importado.";
        const content_hash = createHash("sha256")
          .update(`${product.id}|${product.name}|${content}`)
          .digest("hex");

        const metadata: Record<string, any> = { source: "hotmart_sync_bulk" };
        if (product.ucb) metadata.cover_image = product.ucb;
        if (product.description) metadata.hotmart_description = product.description;

        const { data: existing } = await (supabaseAdmin as any)
          .from("knowledge_nodes")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();

        const { error } = await (supabaseAdmin as any)
          .from("knowledge_nodes")
          .upsert(
            {
              title: product.name,
              slug,
              type: "product",
              status: "approved",
              visibility: "public",
              source_type: "hotmart",
              source_id: String(product.id),
              content,
              content_hash,
              summary: product.description?.slice(0, 280) || null,
              metadata,
              authority_level: "official",
              language: "pt-BR",
            },
            { onConflict: "slug" },
          );

        if (error) {
          console.error(
            "[hotmart-sync] upsert failed",
            "product_id=", product.id,
            "slug=", slug,
            "code=", (error as any).code,
            "message=", error.message,
            "details=", (error as any).details,
            "hint=", (error as any).hint,
          );
          failed += 1;
        } else if (existing) {
          updated += 1;
        } else {
          created += 1;
        }
      }


      return {
        total: allProducts.length,
        created,
        updated,
        failed,
      };
    } catch (e: any) {
      console.error("[hotmart-sync] erro inesperado", e);
      return { error: e?.message || "Erro inesperado durante a sincronização." };
    }
  });
