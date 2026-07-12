import { scanDirectory } from "./scan";
import { parseFile, ParsedNode } from "./parse";
import { validateNode } from "./validate";
import { syncNode, syncEdges } from "./sync";
import { generateIndexationReport } from "./report";
import { evaluateCompleteness } from "./completeness";
import path from "path";
import fs from "fs";
import readline from "readline";

const args = process.argv.slice(2);
const isValidateOnly = args.includes("--validate-only");
const isDryRun =
  args.includes("--dry-run") ||
  (!args.includes("--apply") && !isValidateOnly && !args.includes("--report-only"));
const isApply = args.includes("--apply");
const isReportOnly = args.includes("--report-only");

const typeIndex = args.indexOf("--type");
const filterType = typeIndex > -1 ? args[typeIndex + 1] : null;

const sourceIdIndex = args.indexOf("--source-id");
const filterSourceId = sourceIdIndex > -1 ? args[sourceIdIndex + 1] : null;

async function run() {
  console.log(
    `Starting Knowledge Sync CLI... Mode: ${isApply ? "APPLY" : isValidateOnly ? "VALIDATE-ONLY" : isReportOnly ? "REPORT-ONLY" : "DRY-RUN"}`,
  );

  const rootDir = path.resolve(process.cwd(), "knowledge");
  const files = scanDirectory(rootDir);

  const validNodes: ParsedNode[] = [];
  const errors: any[] = [];

  // 1. Parsing & Validation
  for (const file of files) {
    try {
      const node = parseFile(file);

      if (filterType && node.type !== filterType) continue;
      if (filterSourceId && node.id !== filterSourceId) continue;

      const validationError = validateNode(node);
      if (validationError) {
        errors.push(validationError);
      } else {
        validNodes.push(node);
      }
    } catch (e: any) {
      errors.push({ file, error: e.message || "Failed to parse" });
    }
  }

  console.log(
    `\nFound ${files.length} files. Valid: ${validNodes.length}, Invalid: ${errors.length}`,
  );

  if (isValidateOnly) {
    console.log("\nValidation Errors:");
    errors.forEach((e) => console.log(`- [${e.file}] ${e.error}`));
    process.exit(errors.length > 0 ? 1 : 0);
  }

  if (isReportOnly) {
    // Generate Report without syncing
    generateIndexationReport({
      mode: "report-only",
      filesRead: files.length,
      validNodes: validNodes.length,
      invalidFiles: errors.length,
      securityBlocks: 0,
      nodesCreated: 0,
      draftsUpdated: 0,
      nodesIgnored: 0,
      approvedPreserved: 0,
      revisionsCreated: 0,
      edgesCreated: 0,
      edgesIgnored: 0,
      unresolvedRelations: 0,
      warnings: 0,
      errors: [],
    });
    process.exit(0);
  }

  // 2. Compute Expected Actions & Completeness Table
  console.log("\n--- INVENTÁRIO DO PILOTO ---");
  console.log("| ID | Tipo | Título | Estado atual | Ação | Completude | Relações |");
  console.log("|----|------|--------|--------------|------|------------|----------|");

  const expectedActions: any[] = [];

  for (const node of validNodes) {
    try {
      const completeness = evaluateCompleteness(node);
      const result = await syncNode(node, true); // dryRun to get status
      expectedActions.push({ node, result, completeness });

      const relationsCount = node.relations ? node.relations.length : 0;
      const currentStatus = result.currentStatus || "none";

      console.log(
        `| ${node.id} | ${node.type} | ${node.title} | ${currentStatus} | ${result.status} | ${completeness.score} | ${relationsCount} |`,
      );
    } catch (e: any) {
      console.log(`| ${node.id} | ${node.type} | ${node.title} | ERROR | error | ERROR | 0 |`);
      errors.push({ file: node.source_uri, error: `Dry-run failed: ${e.message}` });
    }
  }

  // Calculate security blocks
  const securityBlocks = errors.filter((e) => e.error.includes("Blocked by secret scanner")).length;

  if (errors.length > 0) {
    console.error("\nErros críticos encontrados no Dry-Run. Abortando sync.");
    process.exit(1);
  }

  if (isDryRun) {
    // Generate dry-run report
    const stats = expectedActions.reduce(
      (acc, curr) => {
        if (curr.result.status === "would_create") acc.created++;
        if (curr.result.status === "would_update") acc.updated++;
        if (curr.result.status === "unchanged") acc.ignored++;
        if (curr.result.status === "pending_revision") acc.approvedPreserved++;
        return acc;
      },
      { created: 0, updated: 0, ignored: 0, approvedPreserved: 0 },
    );

    generateIndexationReport({
      mode: "dry-run",
      filesRead: files.length,
      validNodes: validNodes.length,
      invalidFiles: errors.length,
      securityBlocks,
      nodesCreated: stats.created,
      draftsUpdated: stats.updated,
      nodesIgnored: stats.ignored,
      approvedPreserved: stats.approvedPreserved,
      revisionsCreated: stats.approvedPreserved, // pending revisions map 1:1 with approved preserved
      edgesCreated: 0,
      edgesIgnored: 0,
      unresolvedRelations: 0,
      warnings: 0,
      errors,
      completenessDetails: expectedActions.map((a) => ({
        id: a.node.id,
        type: a.node.type,
        title: a.node.title,
        score: a.completeness.score,
        presentEssential: a.completeness.presentEssential,
        missingEssential: a.completeness.missingEssential,
        presentRecommended: a.completeness.presentRecommended,
        missingRecommended: a.completeness.missingRecommended,
      })),
    });
    process.exit(0);
  }

  // Environment checks for apply
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Cannot run --apply.");
    process.exit(1);
  }

  const isConfirmed = args.includes("--yes");
  if (!isConfirmed) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    await new Promise<void>((resolve) => {
      rl.question(
        `\nVocê está prestes a aplicar ${expectedActions.length} alterações no Knowledge Core.\nDigite APLICAR para continuar.\n> `,
        (answer) => {
          rl.close();
          if (answer.trim() !== "APLICAR") {
            console.warn("Operação cancelada pelo usuário.");
            process.exit(1);
          }
          resolve();
        },
      );
    });
  }

  // 3. Sync Nodes
  const stats = {
    created: 0,
    updated: 0,
    ignored: 0,
    approvedPreserved: 0,
  };

  for (const item of expectedActions) {
    try {
      const result = await syncNode(item.node, false);
      if (result.status === "created") stats.created++;
      if (result.status === "updated") stats.updated++;
      if (result.status === "unchanged") stats.ignored++;
      if (result.status === "pending_revision") stats.approvedPreserved++;
    } catch (e: any) {
      errors.push({ file: item.node.source_uri, error: `Sync Node failed: ${e.message}` });
    }
  }

  // 3. Sync Edges (Pass 2)
  let edgeStats = {
    created: 0,
    ignored: 0,
    missingTargets: 0,
  };

  try {
    const edgeResults = await syncEdges(validNodes, !isApply);
    // Assuming syncEdges returns stats now (we need to update syncEdges to return stats)
    if (edgeResults) {
      edgeStats = edgeResults;
    }
  } catch (e: any) {
    console.error("Failed to sync edges", e);
  }

  console.log(`\nSync complete.
  Nodes Created: ${stats.created}
  Nodes Updated (Drafts): ${stats.updated}
  Nodes Ignored (Unchanged): ${stats.ignored}
  Approved Content Preserved / Revisions Created: ${stats.approvedPreserved}
  `);

  generateIndexationReport({
    mode: isApply ? "apply" : "dry-run",
    filesRead: files.length,
    validNodes: validNodes.length,
    invalidFiles: errors.length,
    securityBlocks,
    nodesCreated: stats.created,
    draftsUpdated: stats.updated,
    nodesIgnored: stats.ignored,
    approvedPreserved: stats.approvedPreserved,
    revisionsCreated: stats.approvedPreserved,
    edgesCreated: edgeStats.created,
    edgesIgnored: edgeStats.ignored,
    unresolvedRelations: edgeStats.missingTargets,
    warnings: edgeStats.missingTargets, // Mapping missing targets as warnings
    errors,
    completenessDetails: expectedActions.map((a) => ({
      id: a.node.id,
      type: a.node.type,
      title: a.node.title,
      score: a.completeness.score,
      presentEssential: a.completeness.presentEssential,
      missingEssential: a.completeness.missingEssential,
      presentRecommended: a.completeness.presentRecommended,
      missingRecommended: a.completeness.missingRecommended,
    })),
  });
}

run().catch(console.error);
