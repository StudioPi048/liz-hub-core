// Edge Function: scrape-hotmart-url
// Extrai og:image e og:description de uma URL pública da Hotmart e enriquece
// o knowledge_node correspondente (marca como approved/official).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function extractMeta(html: string, property: string): string | null {
  // Suporta variações: aspas simples/duplas, ordem invertida (content antes de property),
  // espaços extras e quebras de linha.
  const escProp = property.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");

  const patterns = [
    // property="og:image" content="..."
    new RegExp(
      `<meta[^>]*?property\\s*=\\s*["']${escProp}["'][^>]*?content\\s*=\\s*["']([^"']+)["']`,
      "i",
    ),
    // content="..." property="og:image"
    new RegExp(
      `<meta[^>]*?content\\s*=\\s*["']([^"']+)["'][^>]*?property\\s*=\\s*["']${escProp}["']`,
      "i",
    ),
    // name="og:image" (fallback)
    new RegExp(
      `<meta[^>]*?name\\s*=\\s*["']${escProp}["'][^>]*?content\\s*=\\s*["']([^"']+)["']`,
      "i",
    ),
  ];

  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { productId, url } = await req.json();

    if (!productId || !url) {
      return new Response(
        JSON.stringify({ error: "productId e url são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch da página pública
    const pageRes = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; LizHubBot/1.0; +https://liz-hub-core.lovable.app)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    if (!pageRes.ok) {
      return new Response(
        JSON.stringify({
          error: `Falha ao buscar URL (HTTP ${pageRes.status})`,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const html = await pageRes.text();

    const rawImage = extractMeta(html, "og:image");
    const rawDescription =
      extractMeta(html, "og:description") ??
      extractMeta(html, "description");
    const rawTitle = extractMeta(html, "og:title");

    const coverImage = rawImage ? decodeHtmlEntities(rawImage) : null;
    const description = rawDescription ? decodeHtmlEntities(rawDescription) : null;
    const title = rawTitle ? decodeHtmlEntities(rawTitle) : null;

    // Extrai salesEnabled do JSON embutido do Next.js
    const salesMatch = html.match(/"salesEnabled":\s*(true|false)/i);
    const salesEnabled = salesMatch ? salesMatch[1].toLowerCase() === "true" : false;

    if (!coverImage && !description && !salesMatch) {
      return new Response(
        JSON.stringify({
          error: "Nenhum metadado og:image / og:description encontrado na página",
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Busca metadata atual para mesclar
    const { data: current, error: fetchErr } = await supabaseAdmin
      .from("knowledge_nodes")
      .select("id, metadata, content, summary")
      .eq("id", productId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!current) {
      return new Response(
        JSON.stringify({ error: "Produto não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const mergedMetadata = {
      ...((current.metadata as Record<string, unknown>) ?? {}),
      ...(coverImage ? { cover_image: coverImage, coverUrl: coverImage } : {}),
      ...(title ? { public_title: title } : {}),
      ...(salesEnabled !== null ? { sales_enabled: salesEnabled } : {}),
      enriched_from_url: url,
      enriched_at: new Date().toISOString(),
    };

    const update: Record<string, unknown> = {
      metadata: mergedMetadata,
    };

    if (description) {
      update.content = description;
      if (!current.summary || current.summary.trim().length === 0) {
        update.summary = description.slice(0, 280);
      }
    }

    const { error: updErr } = await supabaseAdmin
      .from("knowledge_nodes")
      .update(update)
      .eq("id", productId);

    if (updErr) throw updErr;

    return new Response(
      JSON.stringify({
        success: true,
        cover_image: coverImage,
        description,
        title,
        sales_enabled: salesEnabled,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("scrape-hotmart-url error", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message ?? "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
