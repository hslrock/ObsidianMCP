import fs from "fs";
import path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getVaultPath } from "./vault.js";
import { findMarkdownFiles, resolveNotePath, relPath, stem, safePath } from "./utils.js";

export function extractTags(content: string): string[] {
  const tags = new Set<string>();

  const tagPattern = /#([a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*)/g;
  for (const m of content.matchAll(tagPattern)) {
    tags.add(m[1]);
  }

  const bracketPattern = /\[\[#([a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*)\]\]/g;
  for (const m of content.matchAll(bracketPattern)) {
    tags.add(m[1]);
  }

  return [...tags].sort();
}

function addTagToContent(content: string, tag: string): string {
  const existing = extractTags(content);
  if (existing.includes(tag)) return content;
  const tagLine = `#${tag}`;
  return content.trim() ? content.trimEnd() + `\n${tagLine}` : tagLine;
}

function removeTagFromContent(content: string, tag: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let result = content.replace(new RegExp(`#${escaped}\\b`, "g"), "");
  result = result.replace(new RegExp(`\\[\\[#${escaped}\\]\\]`, "g"), "");
  result = result.replace(/\n{3,}/g, "\n\n");
  return result.trim();
}

export function registerTagTools(server: McpServer) {
  server.tool(
    "get_note_tags",
    "Extract all tags from a note",
    { note_name: z.string().describe("Name of the note (without .md extension) or relative path") },
    async ({ note_name }) => {
      try {
        const vaultPath = getVaultPath();
        const notePath = resolveNotePath(vaultPath, note_name);
        if (!notePath) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Note not found: ${note_name}`, tags: [] }) }] };

        const content = fs.readFileSync(notePath, "utf-8");
        const tags = extractTags(content);
        return { content: [{ type: "text" as const, text: JSON.stringify({ note_name: stem(notePath), tags, total_tags: tags.length }) }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message, tags: [] }) }] };
      }
    }
  );

  server.tool(
    "search_by_tag",
    "Find all notes containing a specific tag",
    {
      tag: z.string().describe("Tag to search for (without #)"),
      folder: z.string().optional().describe("Optional folder path to limit search"),
    },
    async ({ tag, folder }) => {
      try {
        const vaultPath = getVaultPath();
        const searchPath = folder ? safePath(vaultPath, folder) : vaultPath;
        if (!fs.existsSync(searchPath)) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Folder not found: ${folder}`, matches: [] }) }] };

        const tagLower = tag.toLowerCase();
        const matches: any[] = [];

        for (const mdFile of findMarkdownFiles(searchPath)) {
          try {
            const content = fs.readFileSync(mdFile, "utf-8");
            const noteTags = extractTags(content);
            if (noteTags.some((t) => t.toLowerCase() === tagLower)) {
              matches.push({ name: stem(mdFile), path: relPath(vaultPath, mdFile), tags: noteTags });
            }
          } catch { continue; }
        }

        return { content: [{ type: "text" as const, text: JSON.stringify({ tag, folder: folder || "root", total_matches: matches.length, matches }) }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message, matches: [] }) }] };
      }
    }
  );

  server.tool(
    "add_tag_to_note",
    "Add a tag to a note",
    {
      note_name: z.string().describe("Name of the note (without .md extension) or relative path"),
      tag: z.string().describe("Tag to add (without #)"),
    },
    async ({ note_name, tag }) => {
      try {
        const vaultPath = getVaultPath();
        const notePath = resolveNotePath(vaultPath, note_name);
        if (!notePath) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Note not found: ${note_name}` }) }] };

        const content = fs.readFileSync(notePath, "utf-8");
        const existing = extractTags(content);
        if (existing.includes(tag)) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, note_name: stem(notePath), message: `Tag #${tag} already exists in note`, tags: existing }) }] };
        }

        const updated = addTagToContent(content, tag);
        fs.writeFileSync(notePath, updated, "utf-8");
        return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, note_name: stem(notePath), tag_added: tag, all_tags: extractTags(updated) }) }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message }) }] };
      }
    }
  );

  server.tool(
    "remove_tag_from_note",
    "Remove a tag from a note",
    {
      note_name: z.string().describe("Name of the note (without .md extension) or relative path"),
      tag: z.string().describe("Tag to remove (without #)"),
    },
    async ({ note_name, tag }) => {
      try {
        const vaultPath = getVaultPath();
        const notePath = resolveNotePath(vaultPath, note_name);
        if (!notePath) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Note not found: ${note_name}` }) }] };

        const content = fs.readFileSync(notePath, "utf-8");
        const existing = extractTags(content);
        if (!existing.includes(tag)) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, note_name: stem(notePath), message: `Tag #${tag} not found in note`, tags: existing }) }] };
        }

        const updated = removeTagFromContent(content, tag);
        fs.writeFileSync(notePath, updated, "utf-8");
        return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, note_name: stem(notePath), tag_removed: tag, remaining_tags: extractTags(updated) }) }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message }) }] };
      }
    }
  );

  server.tool(
    "list_all_tags",
    "List all unique tags found in the vault",
    { folder: z.string().optional().describe("Optional folder path to limit search") },
    async ({ folder }) => {
      try {
        const vaultPath = getVaultPath();
        const searchPath = folder ? safePath(vaultPath, folder) : vaultPath;
        if (!fs.existsSync(searchPath)) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Folder not found: ${folder}`, tags: [] }) }] };

        const tagCounts: Record<string, number> = {};
        const tagToNotes: Record<string, { name: string; path: string }[]> = {};

        for (const mdFile of findMarkdownFiles(searchPath)) {
          try {
            const content = fs.readFileSync(mdFile, "utf-8");
            const tags = extractTags(content);
            const rel = relPath(vaultPath, mdFile);
            for (const t of tags) {
              tagCounts[t] = (tagCounts[t] || 0) + 1;
              if (!tagToNotes[t]) tagToNotes[t] = [];
              tagToNotes[t].push({ name: stem(mdFile), path: rel });
            }
          } catch { continue; }
        }

        const sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              folder: folder || "root",
              total_unique_tags: Object.keys(tagCounts).length,
              tags: sorted.map(([tag, count]) => ({ tag, count, notes: tagToNotes[tag] })),
            }),
          }],
        };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message, tags: [] }) }] };
      }
    }
  );
}
