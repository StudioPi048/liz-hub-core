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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Authorize: only admin/editor can trigger sync
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAllowed = roles?.some((r) => r.role === "admin" || r.role === "editor");
    if (!isAllowed) {
      throw new Error("Apenas admins ou editores podem sincronizar o catálogo Hotmart.");
    }

    const { authenticateHotmart } = await import("@/lib/hotmart.server");
    const token = await authenticateHotmart();
    if (!token) {
      throw new Error("Falha ao autenticar com a Hotmart. Verifique as credenciais.");
    }

    // Paginate through the products listing
    const allProducts: HotmartProduct[] = [];
    let pageToken: string | undefined = undefined;
    let safety = 0;

    do {
      const url = new URL("https://developers.hotmart.com/product/rest/v1/products");
      url.searchParams.set("max_results", "50");
      if (pageToken) url.searchParams.set("page_token", pageToken);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Hotmart API erro ${res.status}: ${body.slice(0, 200)}`);
      }
      const json = (await res.json()) as {
        items?: HotmartProduct[];
        page_info?: { next_page_token?: string };
      };
      if (Array.isArray(json.items)) allProducts.push(...json.items);
      pageToken = json.page_info?.next_page_token;
      safety += 1;
    } while (pageToken && safety < 20);

    let created = 0;
    let updated = 0;
    let failed = 0;

    for (const product of allProducts) {
      if (!product?.id || !product?.name) continue;
      const slug = `produto-${product.id}`;

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
            content: product.description || `Produto importado da Hotmart. ID: ${product.id}`,
            summary: product.description?.slice(0, 280) || null,
            metadata,
            authority_level: "official",
          },
          { onConflict: "slug" },
        );

      if (error) {
        console.error("[hotmart-sync] upsert failed", product.id, error.message);
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
  });
