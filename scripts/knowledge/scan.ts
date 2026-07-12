import fs from "fs";
import path from "path";

const IGNORED_DIRS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  "src",
  "supabase",
  "public",
];
const IGNORED_FILES = [
  ".env",
  ".env.local",
  "secrets",
  "client_secret",
  "access_token",
  "private_key",
];
const SECRET_PATTERNS = [/GOCSPX-/, /AIzaSy/];

export function scanDirectory(
  dir: string,
  fileList: string[] = [],
  errors: { file: string; error: string }[] = [],
): string[] {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (!IGNORED_DIRS.includes(file)) {
        scanDirectory(filePath, fileList, errors);
      }
    } else {
      // Secret checks on filename
      if (
        IGNORED_FILES.some((f) => file.includes(f)) ||
        file.endsWith(".pem") ||
        file.endsWith(".key")
      ) {
        errors.push({ file: filePath, error: "Blocked by secret scanner (filename/extension)" });
        continue;
      }

      if (file.endsWith(".md") || file.endsWith(".mdx")) {
        const content = fs.readFileSync(filePath, "utf8");
        // Secret checks on content
        if (SECRET_PATTERNS.some((regex) => regex.test(content))) {
          errors.push({
            file: filePath,
            error: "Blocked by secret scanner (content pattern detected)",
          });
          continue;
        }
        fileList.push(filePath);
      }
    }
  }

  return fileList;
}
