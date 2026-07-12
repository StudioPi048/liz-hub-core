import { ParsedNode } from "./parse";
import { createClient } from "@supabase/supabase-js";
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
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      module: "KNOWLEDGE_SYNC",
      action,
      status,
      node_id: id || node.id,
      hash: node.content_hash,
      message: msg || ""
    }));
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

  if (errSelect && errSelect.code !== 'PGRST116') {
    logEvent("FETCH", "ERROR", null, errSelect.message);
    throw errSelect;
  }

  if (existing) {
    if (existing.content_hash === node.content_hash) {
      logEvent("SYNC", "UNCHANGED", existing.id);
      return { status: "unchanged" };
    } else {
      if (dryRun) {
        logEvent("SYNC", "WOULD_UPDATE", existing.id);
        return { status: "would_update", id: existing.id };
      }

      // Update to draft for new version
      const { error } = await supabase
        .from("knowledge_nodes")
        .update({
          title: node.title,
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
      return { status: "updated", id: existing.id };
    }
  } else {
    if (dryRun) {
      logEvent("SYNC", "WOULD_CREATE", null);
      return { status: "would_create" };
    }

    const { data, error } = await supabase
      .from("knowledge_nodes")
      .insert({
        source_type: node.source_type,
        source_uri: node.source_uri,
        source_id: node.id,
        source_title: node.title,
        title: node.title,
        type: node.type,
        status: node.status,
        authority_level: node.authority_level,
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
    return { status: "created", id: data.id };
  }
}

export async function syncEdges(nodes: ParsedNode[], dryRun: boolean = true) {
  const logEvent = (action: string, status: string, msg?: string) => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      module: "KNOWLEDGE_SYNC",
      action,
      status,
      message: msg || ""
    }));
  };

  if (!supabase) {
    return;
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
        logEvent("SYNC_EDGES", "WARN", `Target node not found in DB: ${rel.target} for source: ${node.id}`);
        continue;
      }

      if (dryRun) {
        logEvent("SYNC_EDGES", "WOULD_CREATE", `${node.id} -[${rel.type}]-> ${rel.target}`);
        continue;
      }

      // Upsert edge
      const { error } = await supabase
        .from("knowledge_edges")
        .upsert({
          source_id: sourceData.id,
          target_id: targetData.id,
          relation_type: rel.type,
          status: 'approved',
          confidence: 1.0
        }, {
          onConflict: 'source_id, target_id, relation_type'
        });

      if (error) {
        logEvent("SYNC_EDGES", "ERROR", `Failed to create edge: ${error.message}`);
      } else {
        logEvent("SYNC_EDGES", "SUCCESS", `${node.id} -[${rel.type}]-> ${rel.target}`);
      }
    }
  }
  logEvent("SYNC_EDGES", "COMPLETE");
}
