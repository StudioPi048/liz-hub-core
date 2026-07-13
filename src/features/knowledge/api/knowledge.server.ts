import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { KNOWLEDGE_TYPES, KnowledgeType } from "../model/knowledge-types";

// Schema for filtering knowledge nodes
export const KnowledgeFilterSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(10),
  query: z.string().optional(),
  type: z
    .enum([...KNOWLEDGE_TYPES, "all"] as [string, ...string[]])
    .optional()
    .default("all"),
  status: z.enum(["draft", "in_review", "approved", "archived", "all"]).optional().default("all"),
});

export const getKnowledgeNodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => KnowledgeFilterSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // We use supabaseAdmin for server side, but we must respect RLS by using the user's token or
    // explicitly ensuring they have the role. The auth middleware gives us context.userId.
    // However, the policy says: "Admins and editors can read all nodes".
    // For now, since this is a protected route, we assume they are allowed, but to be strictly RLS compliant,
    // we should execute the query with the user's JWT.

    // To fetch securely with the user's role, we should ideally instantiate a Supabase client with the user's token.
    // Given the architecture, we will use the admin client but enforce role check here manually, OR we can just rely on the UI/API.
    // Let's use supabaseAdmin but check if the user is admin/editor.
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);

    const isAllowed = roles?.some((r) => r.role === "admin" || r.role === "editor");
    if (!isAllowed) {
      throw new Error("Unauthorized to access knowledge core");
    }

    let query = (supabaseAdmin as any)
      .from("knowledge_nodes")
      .select(
        "id, title, slug, type, status, authority_level, summary, coverUrl:metadata->coverUrl, created_at, updated_at",
        { count: "exact" },
      );

    if (data.type && data.type !== "all") {
      query = query.eq("type", data.type);
    }
    if (data.status && data.status !== "all") {
      query = query.eq("status", data.status);
    }
    if (data.query && data.query.trim() !== "") {
      // Basic text search on title or summary
      // Ideally we'd use full text search: .textSearch('content', data.query)
      query = query.or(`title.ilike.%${data.query}%,summary.ilike.%${data.query}%`);
    }

    const from = (data.page - 1) * data.limit;
    const to = from + data.limit - 1;

    query = query.order("created_at", { ascending: false }).range(from, to);

    const { data: nodes, count, error } = await query;
    if (error) throw error;

    return {
      nodes: nodes || [],
      count: count || 0,
      totalPages: count ? Math.ceil(count / data.limit) : 0,
    };
  });

export const getKnowledgeNodeBySlug = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAllowed = roles?.some((r) => r.role === "admin" || r.role === "editor");
    if (!isAllowed) throw new Error("Unauthorized");

    // Fetch node
    const { data: node, error } = await (supabaseAdmin as any)
      .from("knowledge_nodes")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();

    if (error) throw error;
    if (!node) return null;

    const { data: edgesAsSource } = await (supabaseAdmin as any)
      .from("knowledge_edges")
      .select("*, target:knowledge_nodes!knowledge_edges_target_id_fkey(id, title, slug, type)")
      .eq("source_id", node.id);

    const { data: edgesAsTarget } = await (supabaseAdmin as any)
      .from("knowledge_edges")
      .select("*, source:knowledge_nodes!knowledge_edges_source_id_fkey(id, title, slug, type)")
      .eq("target_id", node.id);

    // Fetch assets and their pending revisions
    const { data: assets } = await (supabaseAdmin as any)
      .from("knowledge_assets")
      .select("*, revisions:knowledge_asset_revisions(*)")
      .eq("knowledge_node_id", node.id)
      .order("sort_order", { ascending: true });

    return {
      node,
      relations: {
        outgoing: edgesAsSource || [],
        incoming: edgesAsTarget || [],
      },
      assets: assets || [],
    };
  });

export const getKnowledgeDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAllowed = roles?.some((r) => r.role === "admin" || r.role === "editor");
    if (!isAllowed) throw new Error("Unauthorized");

    // Simple raw counts grouping
    const { data, error } = await (supabaseAdmin as any)
      .from("knowledge_nodes")
      .select("type, status");

    if (error) throw error;

    const stats = {
      books: 0,
      courses: 0,
      products: 0,
      events: 0,
      authors: 0,
      concepts: 0,
      faq: 0,
      drafts: 0,
      approved: 0,
    };

    (data || []).forEach((n: any) => {
      if (n.type === "book") stats.books++;
      if (n.type === "course") stats.courses++;
      if (n.type === "product") stats.products++;
      if (n.type === "event") stats.events++;
      if (n.type === "author" || n.type === "person") stats.authors++;
      if (n.type === "methodological") stats.concepts++;
      if (n.type === "faq") stats.faq++;

      if (n.status === "draft") stats.drafts++;
      if (n.status === "approved") stats.approved++;
    });

    return stats;
  });

export const getAssetSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ bucket: z.string(), path: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAllowed = roles?.some((r) => r.role === "admin" || r.role === "editor");
    if (!isAllowed) throw new Error("Unauthorized");

    const { data: signedUrl, error } = await supabaseAdmin.storage
      .from(data.bucket)
      .createSignedUrl(data.path, 3600); // 1 hour

    if (error) throw error;
    return { signedUrl: signedUrl.signedUrl };
  });

export const createAssetUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ bucket: z.string(), path: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAllowed = roles?.some((r) => r.role === "admin" || r.role === "editor");
    if (!isAllowed) throw new Error("Unauthorized");

    const { data: uploadUrl, error } = await supabaseAdmin.storage
      .from(data.bucket)
      .createSignedUploadUrl(data.path);

    if (error) throw error;
    return { 
      signedUrl: uploadUrl.signedUrl, 
      token: uploadUrl.token,
      path: uploadUrl.path 
    };
  });

export const registerAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ 
    knowledge_node_id: z.string(),
    stable_id: z.string(),
    asset_type: z.string(),
    asset_category: z.string(),
    name: z.string(),
    storage_provider: z.string(),
    storage_bucket: z.string().optional(),
    storage_path: z.string().optional(),
    external_url: z.string().optional(),
    visibility: z.string().default("internal"),
    rights_status: z.string().default("unknown"),
    is_primary: z.boolean().default(false),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAllowed = roles?.some((r) => r.role === "admin" || r.role === "editor");
    if (!isAllowed) throw new Error("Unauthorized");

    const { data: asset, error } = await (supabaseAdmin as any)
      .from("knowledge_assets")
      .insert({
        ...data,
        source_type: "ui_upload",
        status: "draft",
        created_by: context.userId
      })
      .select()
      .single();

    if (error) throw error;
    return asset;
  });
