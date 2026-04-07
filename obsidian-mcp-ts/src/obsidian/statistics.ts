import fs from "fs";
import path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getVaultPath } from "./vault.js";
import { findMarkdownFiles, resolveNotePath, relPath, stem } from "./utils.js";
import { extractTags } from "./tags.js";
import { extractLinks } from "./links.js";

function topN(counts: Record<string, number>, n: number): { key: string; count: number }[] {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, count]) => ({ key, count }));
}

export function registerStatisticsTools(server: McpServer) {
  server.tool(
    "get_vault_statistics",
    "Get comprehensive statistics about the vault",
    { folder: z.string().optional().describe("Optional folder path to limit statistics") },
    async ({ folder }) => {
      try {
        const vaultPath = getVaultPath();
        const searchPath = folder ? path.join(vaultPath, folder) : vaultPath;
        if (!fs.existsSync(searchPath)) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Folder not found: ${folder}` }) }] };

        let totalNotes = 0, totalSize = 0, totalLines = 0;
        const allTags: string[] = [];
        const allLinks: string[] = [];
        const folders = new Set<string>();

        for (const mdFile of findMarkdownFiles(searchPath)) {
          try {
            const content = fs.readFileSync(mdFile, "utf-8");
            totalNotes++;
            totalSize += content.length;
            totalLines += content.split("\n").length;
            allTags.push(...extractTags(content));
            allLinks.push(...extractLinks(content));
            const rel = path.dirname(relPath(vaultPath, mdFile));
            if (rel !== ".") folders.add(rel);
          } catch { continue; }
        }

        const tagCounts: Record<string, number> = {};
        for (const t of allTags) tagCounts[t] = (tagCounts[t] || 0) + 1;
        const linkCounts: Record<string, number> = {};
        for (const l of allLinks) linkCounts[l] = (linkCounts[l] || 0) + 1;

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              folder: folder || "root",
              total_notes: totalNotes,
              total_size_bytes: totalSize,
              total_size_kb: Math.round((totalSize / 1024) * 100) / 100,
              total_lines: totalLines,
              average_note_size: totalNotes ? Math.round((totalSize / totalNotes) * 100) / 100 : 0,
              average_lines_per_note: totalNotes ? Math.round((totalLines / totalNotes) * 100) / 100 : 0,
              total_folders: folders.size,
              folders: [...folders].sort(),
              unique_tags: Object.keys(tagCounts).length,
              total_tag_instances: allTags.length,
              most_common_tags: topN(tagCounts, 10).map((x) => ({ tag: x.key, count: x.count })),
              unique_links: Object.keys(linkCounts).length,
              total_link_instances: allLinks.length,
              most_linked_notes: topN(linkCounts, 10).map((x) => ({ note: x.key, count: x.count })),
            }),
          }],
        };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message }) }] };
      }
    }
  );

  server.tool(
    "get_note_statistics",
    "Get detailed statistics about a specific note",
    { note_name: z.string().describe("Name of the note (without .md extension) or relative path") },
    async ({ note_name }) => {
      try {
        const vaultPath = getVaultPath();
        const notePath = resolveNotePath(vaultPath, note_name);
        if (!notePath) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Note not found: ${note_name}` }) }] };

        const content = fs.readFileSync(notePath, "utf-8");
        const lines = content.split("\n");
        const tags = extractTags(content);
        const links = extractLinks(content);
        const words = content.split(/\s+/).filter(Boolean);

        const headings: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
        for (const line of lines) {
          const m = line.match(/^(#{1,6})\s/);
          if (m) headings[m[1].length]++;
        }

        const codeBlocks = (content.match(/```/g) || []).length;
        const images = (content.match(/!\[.*?\]\(.*?\)/g) || []).length;
        const externalLinks = (content.match(/\[.*?\]\(https?:\/\/.*?\)/g) || []).length;

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              note_name: stem(notePath),
              path: relPath(vaultPath, notePath),
              size_bytes: content.length,
              size_kb: Math.round((content.length / 1024) * 100) / 100,
              total_lines: lines.length,
              non_empty_lines: lines.filter((l) => l.trim()).length,
              word_count: words.length,
              tags,
              tag_count: tags.length,
              links,
              link_count: links.length,
              headings,
              total_headings: Object.values(headings).reduce((a, b) => a + b, 0),
              code_blocks: Math.floor(codeBlocks / 2),
              images,
              external_links: externalLinks,
            }),
          }],
        };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message }) }] };
      }
    }
  );

  server.tool(
    "find_most_linked_notes",
    "Find the most frequently linked notes in the vault",
    {
      limit: z.number().default(10).describe("Maximum number of notes to return"),
      folder: z.string().optional().describe("Optional folder path to limit search"),
    },
    async ({ limit, folder }) => {
      try {
        const vaultPath = getVaultPath();
        const searchPath = folder ? path.join(vaultPath, folder) : vaultPath;
        if (!fs.existsSync(searchPath)) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Folder not found: ${folder}`, notes: [] }) }] };

        const linkCounts: Record<string, number> = {};
        for (const mdFile of findMarkdownFiles(searchPath)) {
          try {
            const content = fs.readFileSync(mdFile, "utf-8");
            for (const link of extractLinks(content)) linkCounts[link] = (linkCounts[link] || 0) + 1;
          } catch { continue; }
        }

        const mostLinked = topN(linkCounts, limit).map((x) => ({ note: x.key, link_count: x.count }));
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ folder: folder || "root", most_linked_notes: mostLinked, total_unique_notes_linked: Object.keys(linkCounts).length }),
          }],
        };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message, notes: [] }) }] };
      }
    }
  );

  server.tool(
    "get_note_graph_data",
    "Get graph data showing note relationships",
    {
      note_name: z.string().optional().describe("Optional specific note to analyze"),
      depth: z.number().default(1).describe("Depth of relationship traversal"),
    },
    async ({ note_name, depth }) => {
      try {
        const vaultPath = getVaultPath();
        const nodes: any[] = [];
        const edges: any[] = [];

        if (note_name) {
          const notePath = resolveNotePath(vaultPath, note_name);
          if (!notePath) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Note not found: ${note_name}` }) }] };

          nodes.push({ id: stem(notePath), label: stem(notePath), type: "central" });

          const content = fs.readFileSync(notePath, "utf-8");
          for (const link of extractLinks(content)) {
            if (fs.existsSync(path.join(vaultPath, `${link}.md`))) {
              nodes.push({ id: link, label: link, type: "linked" });
              edges.push({ source: stem(notePath), target: link, type: "outgoing" });
            }
          }

          for (const mdFile of findMarkdownFiles(vaultPath)) {
            if (mdFile === notePath) continue;
            try {
              const fileContent = fs.readFileSync(mdFile, "utf-8");
              const fileLinks = extractLinks(fileContent);
              if (fileLinks.includes(stem(notePath)) || fileLinks.includes(note_name)) {
                const id = stem(mdFile);
                if (!nodes.some((n) => n.id === id)) {
                  nodes.push({ id, label: id, type: "backlink" });
                }
                edges.push({ source: id, target: stem(notePath), type: "incoming" });
              }
            } catch { continue; }
          }
        } else {
          const noteMap = new Map<string, string>();
          for (const mdFile of findMarkdownFiles(vaultPath)) {
            const name = stem(mdFile);
            noteMap.set(name, mdFile);
            nodes.push({ id: name, label: name, type: "note" });
          }

          for (const mdFile of findMarkdownFiles(vaultPath)) {
            try {
              const content = fs.readFileSync(mdFile, "utf-8");
              for (const link of extractLinks(content)) {
                if (noteMap.has(link)) {
                  edges.push({ source: stem(mdFile), target: link, type: "link" });
                }
              }
            } catch { continue; }
          }
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ note: note_name || "all", nodes, edges, total_nodes: nodes.length, total_edges: edges.length }),
          }],
        };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message }) }] };
      }
    }
  );
}
