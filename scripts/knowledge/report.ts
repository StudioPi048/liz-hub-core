import { scanDirectory } from "./scan";
import { parseFile } from "./parse";
import { syncNode } from "./sync";
import path from "path";
import fs from "fs";

async function run() {
  const args = process.argv.slice(2);
  const isApply = args.includes("--apply");
  const isDryRun = !isApply;

  console.log(`Starting Knowledge Indexer... Mode: ${isDryRun ? "DRY-RUN" : "APPLY"}`);

  const rootDir = path.resolve(process.cwd(), "knowledge");
  if (!fs.existsSync(rootDir)) {
    console.error("Directory 'knowledge' not found.");
    process.exit(1);
  }

  const errorsArr: { file: string; error: string }[] = [];
  const files = scanDirectory(rootDir, [], errorsArr);
  console.log(`Found ${files.length} markdown files.`);

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let errors = 0;

  const reportData = [];

  for (const err of errorsArr) {
    errors++;
    reportData.push({ file: err.file, status: "error", error: err.error });
  }

  for (const file of files) {
    try {
      const node = parseFile(file);
      const result = await syncNode(node, isDryRun);

      if (result.status === "created" || result.status === "would_create") created++;
      if (result.status === "updated" || result.status === "would_update") updated++;
      if (result.status === "unchanged") unchanged++;
      if (result.status === "skipped") {
        console.warn("Supabase not configured. Skipping DB sync.");
        break;
      }

      reportData.push({ file, status: result.status });
    } catch (e: unknown) {
      const errMessage = e instanceof Error ? e.message : String(e);
      console.error(`Error processing ${file}:`, errMessage);
      errors++;
      reportData.push({ file, status: "error", error: errMessage });
    }
  }

  const report = `
# Relatório de Indexação (Knowledge Base)

Data: ${new Date().toISOString()}
Modo: ${isDryRun ? "DRY-RUN (Nenhuma alteração no DB)" : "APPLY"}

- **Arquivos Lidos:** ${files.length}
- **Nós (A Criar/Criados):** ${created}
- **Nós (A Atualizar/Atualizados):** ${updated}
- **Nós Inalterados:** ${unchanged}
- **Erros:** ${errors}

## Detalhes:
${reportData.map((r) => `- ${r.file}: **${r.status}** ${r.error ? `(${r.error})` : ""}`).join("\n")}
  `.trim();

  const reportDir = path.resolve(process.cwd(), "docs/knowledge");
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, "indexation-report.md"), report);

  console.log(
    `Indexation completed. Report saved to docs/knowledge/indexation-report.md. Errors: ${errors}`,
  );
  if (errors > 0 && isApply) process.exit(1);
}

run().catch(console.error);
