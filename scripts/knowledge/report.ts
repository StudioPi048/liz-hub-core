import path from "path";
import fs from "fs";

export interface CompletenessDetail {
  id: string;
  type: string;
  title: string;
  score: string;
  presentEssential: string[];
  missingEssential: string[];
  presentRecommended: string[];
  missingRecommended: string[];
}

export interface ReportStats {
  mode: "dry-run" | "apply" | "report-only" | "validate-only";
  filesRead: number;
  validNodes: number;
  invalidFiles: number;
  securityBlocks: number;
  nodesCreated: number;
  draftsUpdated: number;
  nodesIgnored: number;
  approvedPreserved: number;
  revisionsCreated: number;
  edgesCreated: number;
  edgesIgnored: number;
  unresolvedRelations: number;
  warnings: number;
  errors: { file: string; error: string }[];
  completenessDetails?: CompletenessDetail[];
  assetsCreated?: number;
  assetsUpdated?: number;
  assetsUnchanged?: number;
  assetsPendingRevision?: number;
  assetsMissingFromManifest?: number;
}

export function generateIndexationReport(stats: ReportStats) {
  const report = `
# Relatório de Ingestão (LIZ HUB Knowledge)

Data: ${new Date().toISOString()}
Modo: ${stats.mode.toUpperCase()}

## Resumo
- **Arquivos Lidos:** ${stats.filesRead}
- **Arquivos Válidos:** ${stats.validNodes}
- **Arquivos Inválidos:** ${stats.invalidFiles}
- **Bloqueios de Segurança:** ${stats.securityBlocks}

## Nós (Nodes)
- **Criados:** ${stats.nodesCreated}
- **Atualizados (Drafts):** ${stats.draftsUpdated}
- **Inalterados:** ${stats.nodesIgnored}
- **Preservados (Aprovados):** ${stats.approvedPreserved}
- **Revisões Pendentes Criadas:** ${stats.revisionsCreated}

## Relações (Edges)
- **Arestas Criadas:** ${stats.edgesCreated}
- **Arestas Ignoradas/Duplicadas:** ${stats.edgesIgnored}
- **Relações Não Resolvidas (Alvo Inexistente):** ${stats.unresolvedRelations}

## Ativos (Assets)
- **Ativos Criados:** ${stats.assetsCreated || 0}
- **Ativos Atualizados (Drafts):** ${stats.assetsUpdated || 0}
- **Ativos Inalterados:** ${stats.assetsUnchanged || 0}
- **Revisões Pendentes de Ativos:** ${stats.assetsPendingRevision || 0}
- **Ausentes no Manifesto (Removidos do MD):** ${stats.assetsMissingFromManifest || 0}

## Logs
- **Alertas (Warnings):** ${stats.warnings}
- **Erros (Críticos/Validação):** ${stats.errors.length}

${stats.errors.length > 0 ? `## Detalhe de Erros\n${stats.errors.map((r) => `- [${r.file}] ${r.error}`).join("\n")}` : ""}

${
  stats.completenessDetails && stats.completenessDetails.length > 0
    ? `## Detalhamento de Completude
${stats.completenessDetails
  .map(
    (c) => `
### ${c.title} (${c.type}) - \`${c.id}\`
- **Score:** ${c.score.toUpperCase()}
- **Essenciais Presentes:** ${c.presentEssential.join(", ") || "Nenhum"}
- **Essenciais Ausentes:** ${c.missingEssential.join(", ") || "Nenhum"}
- **Recomendados Presentes:** ${c.presentRecommended.join(", ") || "Nenhum"}
- **Recomendados Ausentes:** ${c.missingRecommended.join(", ") || "Nenhum"}
`,
  )
  .join("")}`
    : ""
}
  `.trim();

  const reportDir = path.resolve(process.cwd(), "docs/knowledge");
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, "indexation-report.md"), report);

  console.log(`Report saved to docs/knowledge/indexation-report.md`);
}
