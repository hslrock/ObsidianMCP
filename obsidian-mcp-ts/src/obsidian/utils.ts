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

/**
 * Validate that a resolved path is inside the vault.
 * Prevents path traversal attacks (e.g. ../../etc/passwd).
 */
export function assertInsideVault(vaultPath: string, targetPath: string): void {
  const resolved = path.resolve(targetPath);
  const vault = path.resolve(vaultPath);
  if (!resolved.startsWith(vault + path.sep) && resolved !== vault) {
    throw new Error(`Access denied: path is outside the vault`);
  }
}

/** Resolve a note name to an absolute path. Returns undefined if not found. */
export function resolveNotePath(
  vaultPath: string,
  noteName: string
): string | undefined {
  const withExt = path.join(vaultPath, `${noteName}.md`);
  assertInsideVault(vaultPath, withExt);
  if (fs.existsSync(withExt)) return withExt;

  const asIs = path.join(vaultPath, noteName);
  assertInsideVault(vaultPath, asIs);
  if (fs.existsSync(asIs)) return asIs;

  return undefined;
}

/** Safely join a path inside the vault, with traversal check. */
export function safePath(vaultPath: string, ...segments: string[]): string {
  const result = path.join(vaultPath, ...segments);
  assertInsideVault(vaultPath, result);
  return result;
}

/** Get relative path from vault root. */
export function relPath(vaultPath: string, filePath: string): string {
  return path.relative(vaultPath, filePath);
}

/** Get file stem (name without extension). */
export function stem(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}
