import fs from "fs";
import path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getVaultPath } from "./vault.js";
import { findMarkdownFiles, resolveNotePath, relPath, stem } from "./utils.js";

export function extractLinks(content: string): string[] {
  const links: string[] = [];
  const pattern = /\[\[([^\]#|]+)(?:[#|][^\]]+)?\]\]/g;
  for (const m of content.matchAll(pattern)) {
    const name = m[1].trim();
    if (name) links.push(name);
  }
  return links;
}

function extractLinksWithDetails(content: string): { note: string; heading: string | null; alias: string | null }[] {
  const links: { note: string; heading: string | null; alias: string | null }[] = [];
  const pattern = /\[\[([^\]#|]+)(?:#([^|]+))?(?:\|([^\]]+))?\]\]/g;
  for (const m of content.matchAll(pattern)) {
    const note = m[1].trim();
    const heading = m[2]?.trim() || null;
    const alias = m[3]?.trim() || null;
    if (note) links.push({ note, heading, alias });
  }
  return links;
}

export function registerLinkTools(server: McpServer) {
  server.tool(
    "get_note_links",
    "Extract all links from a note",
    { note_name: z.string().describe("Name of the note (without .md extension) or relative path") },
    async ({ note_name }) => {
      try {
        const vaultPath = getVaultPath();
        const notePath = resolveNotePath(vaultPath, note_name);
        if (!notePath) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Note not found: ${note_name}`, links: [] }) }] };

        const content = fs.readFileSync(notePath, "utf-8");
        const links = extractLinks(content);
        const details = extractLinksWithDetails(content);
        return { content: [{ type: "text" as const, text: JSON.stringify({ note_name: stem(notePath), links, links_with_details: details, total_links: links.length }) }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message, links: [] }) }] };
      }
    }
  );

  server.tool(
    "get_backlinks",
    "Find all notes that link to a specific note",
    { note_name: z.string().describe("Name of the note to find backlinks for") },
    async ({ note_name }) => {
      try {
        const vaultPath = getVaultPath();
        const targetPath = resolveNotePath(vaultPath, note_name);
        if (!targetPath) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Note not found: ${note_name}`, backlinks: [] }) }] };

        const targetName = stem(targetPath);
        const backlinks: { name: string; path: string }[] = [];

        for (const mdFile of findMarkdownFiles(vaultPath)) {
          if (mdFile === targetPath) continue;
          try {
            const content = fs.readFileSync(mdFile, "utf-8");
            const links = extractLinks(content);
            if (links.includes(targetName) || links.includes(note_name)) {
              backlinks.push({ name: stem(mdFile), path: relPath(vaultPath, mdFile) });
            }
          } catch { continue; }
        }

        return { content: [{ type: "text" as const, text: JSON.stringify({ note_name, backlinks, total_backlinks: backlinks.length }) }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message, backlinks: [] }) }] };
      }
    }
  );

  server.tool(
    "create_link_between_notes",
    "Create a link from one note to another",
    {
      from_note: z.string().describe("Source note name (without .md extension)"),
      to_note: z.string().describe("Target note name (without .md extension)"),
      alias: z.string().optional().describe("Optional alias for the link"),
      append: z.boolean().default(true).describe("If true, append link; if false, prepend"),
    },
    async ({ from_note, to_note, alias, append }) => {
      try {
        const vaultPath = getVaultPath();
        const fromPath = resolveNotePath(vaultPath, from_note);
        if (!fromPath) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Source note not found: ${from_note}` }) }] };

        const content = fs.readFileSync(fromPath, "utf-8");
        const existing = extractLinks(content);
        if (existing.includes(to_note)) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, message: `Link from ${from_note} to ${to_note} already exists`, from_note, to_note }) }] };
        }

        const linkStr = alias ? `[[${to_note}|${alias}]]` : `[[${to_note}]]`;
        const updated = append ? content.trimEnd() + `\n${linkStr}` : `${linkStr}\n${content}`;
        fs.writeFileSync(fromPath, updated, "utf-8");

        return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, from_note, to_note, link: linkStr, alias: alias || null }) }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message }) }] };
      }
    }
  );

  server.tool(
    "find_orphaned_notes",
    "Find notes that are not linked by any other note",
    { folder: z.string().optional().describe("Optional folder path to limit search") },
    async ({ folder }) => {
      try {
        const vaultPath = getVaultPath();
        const searchPath = folder ? path.join(vaultPath, folder) : vaultPath;
        if (!fs.existsSync(searchPath)) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Folder not found: ${folder}`, orphaned_notes: [] }) }] };

        const allNotes = new Set<string>();
        const linkedNotes = new Set<string>();

        for (const mdFile of findMarkdownFiles(searchPath)) {
          allNotes.add(stem(mdFile));
          try {
            const content = fs.readFileSync(mdFile, "utf-8");
            for (const link of extractLinks(content)) linkedNotes.add(link);
          } catch { continue; }
        }

        const orphaned = [...allNotes].filter((n) => !linkedNotes.has(n)).sort();
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ folder: folder || "root", total_notes: allNotes.size, linked_notes: linkedNotes.size, orphaned_notes: orphaned, total_orphaned: orphaned.length }),
          }],
        };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message, orphaned_notes: [] }) }] };
      }
    }
  );

  server.tool(
    "find_broken_links",
    "Find links that point to non-existent notes",
    { folder: z.string().optional().describe("Optional folder path to limit search") },
    async ({ folder }) => {
      try {
        const vaultPath = getVaultPath();
        const searchPath = folder ? path.join(vaultPath, folder) : vaultPath;
        if (!fs.existsSync(searchPath)) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Folder not found: ${folder}`, broken_links: [] }) }] };

        const existingNotes = new Set<string>();
        for (const mdFile of findMarkdownFiles(vaultPath)) {
          existingNotes.add(stem(mdFile));
          existingNotes.add(path.basename(mdFile));
        }

        const brokenLinks: { source_note: string; source_path: string; broken_link: string }[] = [];

        for (const mdFile of findMarkdownFiles(searchPath)) {
          try {
            const content = fs.readFileSync(mdFile, "utf-8");
            for (const link of extractLinks(content)) {
              if (!existingNotes.has(link)) {
                brokenLinks.push({ source_note: stem(mdFile), source_path: relPath(vaultPath, mdFile), broken_link: link });
              }
            }
          } catch { continue; }
        }

        return { content: [{ type: "text" as const, text: JSON.stringify({ folder: folder || "root", broken_links: brokenLinks, total_broken: brokenLinks.length }) }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message, broken_links: [] }) }] };
      }
    }
  );
}
