import fs from "fs";
import path from "path";

/** Recursively find all .md files, skipping .obsidian directories. */
export function findMarkdownFiles(dir: string): string[] {
  const results: string[] = [];

  function walk(current: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === ".obsidian") continue;
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}

/** Resolve a note name to an absolute path. Returns undefined if not found. */
export function resolveNotePath(
  vaultPath: string,
  noteName: string
): string | undefined {
  const withExt = path.join(vaultPath, `${noteName}.md`);
  if (fs.existsSync(withExt)) return withExt;

  const asIs = path.join(vaultPath, noteName);
  if (fs.existsSync(asIs)) return asIs;

  return undefined;
}

/** Get relative path from vault root. */
export function relPath(vaultPath: string, filePath: string): string {
  return path.relative(vaultPath, filePath);
}

/** Get file stem (name without extension). */
export function stem(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}
