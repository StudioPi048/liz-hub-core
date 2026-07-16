import { ParsedNode, AssetNode } from "./parse";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (cannot be VITE_).");
}

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export async function syncNode(node: ParsedNode, dryRun: boolean = true) {
  const logEvent = (action: string, status: string, id: string | null = null, msg?: string) => {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        module: "KNOWLEDGE_SYNC",
        action,
        status,
        node_id: id || node.id,
        hash: node.content_hash,
        message: msg || "",
      }),
    );
  };

  if (!supabase) {
    logEvent("SYNC", "SKIPPED", null, "No supabase client");
    return { status: "skipped", reason: "no_client" };
  }

  // Check if exists
  const { data: existing, error: errSelect } = await supabase
    .from("knowledge_nodes")
    .select("id, content_hash, status")
    .eq("source_type", node.source_type)
    .eq("source_id", node.id)
    .maybeSingle();

  if (errSelect && errSelect.code !== "PGRST116") {
    logEvent("FETCH", "ERROR", null, errSelect.message);
    throw errSelect;
  }

  if (existing) {
    if (existing.content_hash === node.content_hash) {
      logEvent("SYNC", "UNCHANGED", existing.id);
      return { status: "unchanged", currentStatus: existing.status };
    } else {
      // Protection for approved content
      if (existing.status === "approved") {
        if (dryRun) {
          logEvent("SYNC", "WOULD_CREATE_REVISION", existing.id, "Approved content changed");
          return { status: "pending_revision", id: existing.id, currentStatus: existing.status };
        }

        // Create persistent revision
        const { error: draftError } = await supabase.from("editorial_drafts").upsert(
          {
            knowledge_node_id: existing.id,
            source_id: node.id,
            proposed_title: node.title,
            proposed_summary: node.summary,
            proposed_content: node.content,
            proposed_metadata: node.metadata,
            previous_content_hash: existing.content_hash,
            proposed_content_hash: node.content_hash,
            source_type: node.source_type,
            source_uri: node.source_uri,
            status: "proposed",
          },
          {
            onConflict: "knowledge_node_id, proposed_content_hash",
          },
        );

        if (draftError) {
          logEvent("UPDATE", "ERROR_DRAFT", existing.id, draftError.message);
          throw draftError;
        }

        logEvent(
          "UPDATE",
          "CREATED_REVISION",
          existing.id,
          "Content changed but node is approved. Revision pending human review.",
        );
        return { status: "pending_revision", id: existing.id, currentStatus: existing.status };
      }

      if (dryRun) {
        logEvent("SYNC", "WOULD_UPDATE", existing.id);
        return { status: "would_update", id: existing.id, currentStatus: existing.status };
      }

      // Update to draft for new version
      const { error } = await supabase
        .from("knowledge_nodes")
        .update({
          title: node.title,
          slug: node.slug,
          type: node.type,
          status: "draft",
          authority_level: "unverified",
          visibility: node.visibility,
          content: node.content,
          content_hash: node.content_hash,
          metadata: node.metadata,
          author_name: node.author,
          summary: node.summary,
        })
        .eq("id", existing.id);

      if (error) {
        logEvent("UPDATE", "ERROR", existing.id, error.message);
        throw error;
      }
      logEvent("UPDATE", "SUCCESS", existing.id);
      return { status: "updated", id: existing.id, currentStatus: existing.status };
    }
  } else {
    if (dryRun) {
      logEvent("SYNC", "WOULD_CREATE", null);
      return { status: "would_create", currentStatus: "none" };
    }

    const { data, error } = await supabase
      .from("knowledge_nodes")
      .insert({
        source_type: node.source_type,
        source_uri: node.source_uri,
        source_id: node.id,
        source_title: node.title,
        title: node.title,
        slug: node.slug,
        type: node.type,
        status: "draft",
        authority_level: "unverified",
        visibility: node.visibility,
        content: node.content,
        content_hash: node.content_hash,
        metadata: node.metadata,
        author_name: node.author,
        language: node.language,
        summary: node.summary,
      })
      .select()
      .single();

    if (error) {
      logEvent("CREATE", "ERROR", null, error.message);
      throw error;
    }
    logEvent("CREATE", "SUCCESS", data.id);
    return { status: "created", id: data.id, currentStatus: "none" };
  }
}

export async function syncEdges(nodes: ParsedNode[], dryRun: boolean = true) {
  const logEvent = (action: string, status: string, msg?: string) => {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        module: "KNOWLEDGE_SYNC",
        action,
        status,
        message: msg || "",
      }),
    );
  };

  const stats = {
    created: 0,
    ignored: 0,
    missingTargets: 0,
  };

  if (!supabase) {
    return stats;
  }

  logEvent("SYNC_EDGES", "START", `Processing ${nodes.length} nodes for edges`);

  for (const node of nodes) {
    if (!node.relations || node.relations.length === 0) continue;

    // Resolve source_id
    const { data: sourceData } = await supabase
      .from("knowledge_nodes")
      .select("id")
      .eq("source_id", node.id)
      .maybeSingle();

    if (!sourceData) {
      logEvent("SYNC_EDGES", "WARN", `Source node not found in DB: ${node.id}`);
      continue;
    }

    for (const rel of node.relations) {
      // Resolve target_id
      const { data: targetData } = await supabase
        .from("knowledge_nodes")
        .select("id")
        .eq("source_id", rel.target)
        .maybeSingle();

      if (!targetData) {
        logEvent(
          "SYNC_EDGES",
          "WARN",
          `Target node not found in DB: ${rel.target} for source: ${node.id}`,
        );
        stats.missingTargets++;
        continue;
      }

      if (dryRun) {
        logEvent("SYNC_EDGES", "WOULD_CREATE", `${node.id} -[${rel.type}]-> ${rel.target}`);
        stats.created++;
        continue;
      }

      // Upsert edge
      const { error } = await supabase.from("knowledge_edges").upsert(
        {
          source_id: sourceData.id,
          target_id: targetData.id,
          relation_type: rel.type,
          status: "proposed",
          confidence: 1.0,
          metadata: {
            reason: "declared_in_frontmatter",
            origin: node.source_uri,
          },
        },
        {
          onConflict: "source_id, target_id, relation_type",
        },
      );

      if (error) {
        logEvent("SYNC_EDGES", "ERROR", `Failed to create edge: ${error.message}`);
      } else {
        logEvent("SYNC_EDGES", "SUCCESS", `${node.id} -[${rel.type}]-> ${rel.target}`);
        stats.created++;
      }
    }
  }
  logEvent("SYNC_EDGES", "COMPLETE");
  return stats;
}

export async function syncAssets(nodes: ParsedNode[], dryRun: boolean = true) {
  const logEvent = (action: string, status: string, msg?: string) => {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        module: "KNOWLEDGE_SYNC_ASSETS",
        action,
        status,
        message: msg || "",
      }),
    );
  };

  const stats = {
    created: 0,
    updated_draft: 0,
    pending_revision: 0,
    unchanged: 0,
    missing_from_manifest: 0,
    missing_targets: 0,
    errors: 0,
  };

  if (!supabase) {
    return stats;
  }

  logEvent("SYNC_ASSETS", "START", `Processing ${nodes.length} nodes for assets`);

  for (const node of nodes) {
    // Obter node UUID do DB
    const { data: dbNode } = await supabase
      .from("knowledge_nodes")
      .select("id")
      .eq("source_id", node.id)
      .maybeSingle();

    if (!dbNode) {
      logEvent("SYNC_ASSETS", "WARN", `Source node not found in DB: ${node.id}`);
      stats.missing_targets++;
      continue;
    }

    const manifestAssets = node.assets || [];
    const stableIdsInManifest = new Set(manifestAssets.map((a) => a.id));

    // Buscar assets existentes para este node
    const { data: existingAssets, error: fetchErr } = await supabase
      .from("knowledge_assets")
      .select("id, stable_id, status, metadata")
      .eq("knowledge_node_id", dbNode.id);

    if (fetchErr) {
      logEvent(
        "SYNC_ASSETS",
        "ERROR",
        `Failed to fetch assets for node ${node.id}: ${fetchErr.message}`,
      );
      stats.errors++;
      continue;
    }

    const existingAssetMap = new Map(existingAssets?.map((a) => [a.stable_id, a]) || []);

    // 1. Processar assets declarados no manifesto
    for (const asset of manifestAssets) {
      // Calculate manifest hash
      const manifestHash = crypto.createHash("sha256").update(JSON.stringify(asset)).digest("hex");
      const existing = existingAssetMap.get(asset.id);

      const assetPayload = {
        knowledge_node_id: dbNode.id,
        stable_id: asset.id,
        asset_type: asset.type,
        asset_category: asset.category,
        name: asset.name,
        description: asset.description || null,
        alt_text: asset.alt_text || null,
        storage_provider: asset.provider,
        storage_bucket: asset.bucket || null,
        storage_path: asset.path || null,
        external_url: asset.external_url || null,
        status: "draft", // always default to draft on creation
        visibility: asset.visibility,
        rights_status: asset.rights_status,
        is_primary: asset.is_primary,
        source_type: "repository_file",
        source_reference: node.source_uri,
        metadata: {
          manifest_hash: manifestHash,
        },
      };

      if (!existing) {
        if (dryRun) {
          logEvent("SYNC_ASSETS", "WOULD_CREATE", `${node.id} -> ${asset.id}`);
          stats.created++;
          continue;
        }

        const { error: insertErr } = await supabase.from("knowledge_assets").insert(assetPayload);

        if (insertErr) {
          logEvent(
            "SYNC_ASSETS",
            "ERROR",
            `Failed to create asset ${asset.id}: ${insertErr.message}`,
          );
          stats.errors++;
        } else {
          logEvent("SYNC_ASSETS", "CREATED", `${node.id} -> ${asset.id}`);
          stats.created++;
        }
      } else {
        const existingManifestHash = existing.metadata?.manifest_hash;

        if (existingManifestHash === manifestHash) {
          logEvent("SYNC_ASSETS", "UNCHANGED", `${node.id} -> ${asset.id}`);
          stats.unchanged++;
          continue;
        }

        // Alterou
        if (existing.status === "approved") {
          if (dryRun) {
            logEvent("SYNC_ASSETS", "WOULD_CREATE_REVISION", `${node.id} -> ${asset.id}`);
            stats.pending_revision++;
            continue;
          }

          // Criar revisão persistente (Lote 4A)
          const revisionPayload = {
            knowledge_asset_id: existing.id,
            knowledge_node_id: dbNode.id,
            stable_id: asset.id,
            proposed_name: asset.name,
            proposed_description: asset.description || null,
            proposed_alt_text: asset.alt_text || null,
            proposed_asset_type: asset.type,
            proposed_asset_category: asset.category,
            proposed_storage_provider: asset.provider,
            proposed_storage_bucket: asset.bucket || null,
            proposed_storage_path: asset.path || null,
            proposed_external_url: asset.external_url || null,
            proposed_visibility: asset.visibility,
            proposed_rights_status: asset.rights_status,
            proposed_metadata: { manifest_hash: manifestHash },
            proposed_manifest_hash: manifestHash,
            reason: "repository_manifest_changed",
            status: "proposed",
          };

          const { error: revErr } = await supabase
            .from("knowledge_asset_revisions")
            .upsert(revisionPayload, { onConflict: "knowledge_asset_id, proposed_manifest_hash" });

          if (revErr) {
            logEvent(
              "SYNC_ASSETS",
              "ERROR_REVISION",
              `Failed to create revision for ${asset.id}: ${revErr.message}`,
            );
            stats.errors++;
          } else {
            logEvent(
              "SYNC_ASSETS",
              "CREATED_REVISION",
              `Asset ${asset.id} approved but changed. Revision pending.`,
            );
            stats.pending_revision++;
          }
        } else {
          // Draft ou outro status mutável
          if (dryRun) {
            logEvent("SYNC_ASSETS", "WOULD_UPDATE_DRAFT", `${node.id} -> ${asset.id}`);
            stats.updated_draft++;
            continue;
          }

          const { error: updErr } = await supabase
            .from("knowledge_assets")
            .update(assetPayload)
            .eq("id", existing.id);

          if (updErr) {
            logEvent(
              "SYNC_ASSETS",
              "ERROR",
              `Failed to update asset ${asset.id}: ${updErr.message}`,
            );
            stats.errors++;
          } else {
            logEvent("SYNC_ASSETS", "UPDATED_DRAFT", `${node.id} -> ${asset.id}`);
            stats.updated_draft++;
          }
        }
      }
    }

    // 2. Verificar assets que estão no DB mas ausentes no manifesto
    if (existingAssets) {
      for (const exAsset of existingAssets) {
        if (!stableIdsInManifest.has(exAsset.stable_id)) {
          // Não apagar automaticamente. Apenas logar.
          logEvent(
            "SYNC_ASSETS",
            "MISSING_FROM_MANIFEST",
            `Asset ${exAsset.stable_id} is in DB but not in manifest for ${node.id}`,
          );
          stats.missing_from_manifest++;
        }
      }
    }
  }

  logEvent("SYNC_ASSETS", "COMPLETE");
  return stats;
}
