import { scanDirectory } from "./scan";
import { parseFile, ParsedNode } from "./parse";
import { evaluateCompleteness } from "./completeness";
import path from "path";
import fs from "fs";

function generateInventory() {
  const rootDir = path.resolve(process.cwd(), "knowledge");
  const files = scanDirectory(rootDir);

  const nodes: ParsedNode[] = [];
  const errors: any[] = [];

  for (const file of files) {
    try {
      const node = parseFile(file);
      nodes.push(node);
    } catch (e: any) {
      errors.push({ file, error: e.message || "Failed to parse" });
    }
  }

  // 1. Inventário Completo
  const byType: Record<string, ParsedNode[]> = {};
  nodes.forEach((n) => {
    if (!byType[n.type]) byType[n.type] = [];
    byType[n.type].push(n);
  });

  const allRelations = nodes.flatMap((n) =>
    (n.relations || []).map((r) => ({ from: n.id, to: r.target, type: r.type })),
  );

  let md = `# Inventário do Patrimônio Intelectual (LIZ HUB)\n\n`;
  md += `Data de geração: ${new Date().toISOString()}\n\n`;
  md += `Total de registros válidos: ${nodes.length}\n\n`;

  md += `## 1. Inventário Completo\n\n`;
  for (const [type, typeNodes] of Object.entries(byType)) {
    md += `### ${type.toUpperCase()}\n`;
    typeNodes.forEach((n) => {
      const comp = evaluateCompleteness(n);
      const icon = comp.score === "complete" ? "✓" : comp.score === "partial" ? "⚠️" : "❌";
      md += `${icon} ${n.title} (\`${n.id}\`)\n`;
    });
    md += `\n`;
  }

  // 2. Percentual de cobertura
  md += `## 2. Índice de Cobertura\n\n`;
  for (const [type, typeNodes] of Object.entries(byType)) {
    const complete = typeNodes.filter((n) => evaluateCompleteness(n).score === "complete").length;
    const partial = typeNodes.filter((n) => evaluateCompleteness(n).score === "partial").length;
    const minimal = typeNodes.filter((n) => evaluateCompleteness(n).score === "minimal").length;
    const invalid = typeNodes.filter((n) => evaluateCompleteness(n).score === "invalid").length;

    md += `- **${type.toUpperCase()}**: ${typeNodes.length} cadastrados\n`;
    md += `  - Completos: ${complete} (${((complete / typeNodes.length) * 100).toFixed(1)}%)\n`;
    md += `  - Parciais: ${partial}\n`;
    md += `  - Incompletos/Mínimos: ${minimal}\n`;
    md += `  - Inválidos: ${invalid}\n`;
  }
  md += `\n`;

  // 3. Entidades Órfãs
  md += `## 3. Entidades Órfãs\n\n`;
  md += `> Registros que não possuem conexões de saída nem de entrada.\n\n`;

  const orphans = nodes.filter((n) => {
    const hasOutbound = n.relations && n.relations.length > 0;
    const hasInbound = allRelations.some((r) => r.to === n.id);
    return !hasOutbound && !hasInbound;
  });

  if (orphans.length === 0) {
    md += `Nenhuma entidade órfã encontrada.\n\n`;
  } else {
    orphans.forEach((o) => {
      md += `- ${o.title} (${o.type})\n`;
    });
    md += `\n`;
  }

  // 4. Entidades Duplicadas
  md += `## 4. Entidades Duplicadas (Potenciais)\n\n`;
  const byTitle: Record<string, string[]> = {};
  nodes.forEach((n) => {
    const t = n.title.toLowerCase();
    if (!byTitle[t]) byTitle[t] = [];
    byTitle[t].push(n.id);
  });

  let hasDups = false;
  for (const [t, ids] of Object.entries(byTitle)) {
    if (ids.length > 1) {
      md += `- Título "${t}" aparece em: ${ids.join(", ")}\n`;
      hasDups = true;
    }
  }
  if (!hasDups) md += `Nenhuma duplicidade potencial por título encontrada.\n`;
  md += `\n`;

  // 5. Relações Ausentes
  md += `## 5. Relações Ausentes / Broken Links\n\n`;
  const allIds = new Set(nodes.map((n) => n.id));
  const brokenLinks = allRelations.filter((r) => !allIds.has(r.to));

  if (brokenLinks.length > 0) {
    md += `### Links Quebrados (Destino não encontrado)\n`;
    brokenLinks.forEach((bl) => {
      md += `- \`${bl.from}\` aponta para \`${bl.to}\` (${bl.type})\n`;
    });
  } else {
    md += `Nenhum link quebrado encontrado.\n`;
  }
  md += `\n`;

  // 6. Campos Obrigatórios Faltantes
  md += `## 6. Campos Obrigatórios Faltantes\n\n`;
  let hasMissing = false;
  nodes.forEach((n) => {
    const comp = evaluateCompleteness(n);
    if (comp.missingEssential.length > 0) {
      md += `- **${n.title}** (\`${n.id}\`): Falta ${comp.missingEssential.join(", ")}\n`;
      hasMissing = true;
    }
  });
  if (!hasMissing) md += `Todos os registros possuem seus campos essenciais.\n`;
  md += `\n`;

  // 7. Qualidade Editorial
  md += `## 7. Qualidade Editorial\n\n`;
  const approvedOfficial = nodes.filter(
    (n) => n.status === "approved" && n.authority_level === "official",
  ).length;
  const draftUnverified = nodes.filter(
    (n) => n.status === "draft" || n.authority_level === "unverified",
  ).length;

  md += `- Aprovados e Oficiais: ${approvedOfficial}\n`;
  md += `- Rascunhos ou Não Verificados: ${draftUnverified}\n`;
  md += `- Demais estados: ${nodes.length - approvedOfficial - draftUnverified}\n\n`;

  // 8. Prioridade de Enriquecimento
  md += `## 8. Prioridade Automática de Enriquecimento\n\n`;
  md += `Com base no status 'partial' e 'minimal', aqui estão os Top 10 ativos precisando de atenção imediata (campos faltantes ou falta de relações):\n\n`;

  const enrichmentQueue = nodes
    .filter((n) => {
      const comp = evaluateCompleteness(n);
      return comp.score !== "complete";
    })
    .sort((a, b) => {
      // Prioritize books and courses over pages
      if (a.type === "book" && b.type !== "book") return -1;
      if (a.type === "course" && b.type !== "course") return -1;
      return 0;
    })
    .slice(0, 10);

  enrichmentQueue.forEach((n) => {
    const comp = evaluateCompleteness(n);
    md += `- **${n.title}** (${n.type}): Faltam recomendados (${comp.missingRecommended.join(", ")}) ou essenciais (${comp.missingEssential.join(", ")})\n`;
  });

  // 9. Backlog Editorial de Ativos Ausentes
  md += `## 9. Backlog Editorial de Ativos Ausentes\n\n`;
  md += `Nesta seção, listamos os ativos (mídias, documentos, páginas) que estão faltando para que a entidade seja considerada completamente instrumentalizada para publicação/venda.\n\n`;

  let hasMissingAssets = false;
  nodes.forEach((n) => {
    const comp = evaluateCompleteness(n);
    const missingAssets = comp.missingRecommended.filter((f) => f.startsWith("asset:"));
    if (missingAssets.length > 0) {
      hasMissingAssets = true;
      md += `### ${n.title} (${n.type})\n`;
      md += `- Faltam: ${missingAssets.map((a) => a.replace("asset:", "")).join(", ")}\n\n`;
    }
  });

  if (!hasMissingAssets) {
    md += `Nenhum ativo obrigatório/recomendado ausente foi detectado nas entidades principais.\n\n`;
  }

  const outPath = path.resolve(process.cwd(), "docs/knowledge_inventory.md");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, md);
  console.log(`Knowledge Inventory generated at ${outPath}`);
}

generateInventory();
