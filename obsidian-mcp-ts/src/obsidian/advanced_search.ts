import fs from "fs";
import path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getVaultPath } from "./vault.js";
import { findMarkdownFiles, relPath, stem, safePath } from "./utils.js";

function fuzzyMatch(query: string, text: string): boolean {
  const qLower = query.toLowerCase();
  const tLower = text.toLowerCase();
  let qi = 0;
  for (const ch of tLower) {
    if (qi < qLower.length && ch === qLower[qi]) qi++;
  }
  return qi === qLower.length;
}

export function registerAdvancedSearchTools(server: McpServer) {
  server.tool(
    "search_by_regex",
    "Search for notes using regular expression pattern",
    {
      pattern: z.string().describe("Regular expression pattern to search for"),
      folder: z.string().optional().describe("Optional folder path to limit search"),
    },
    async ({ pattern, folder }) => {
      try {
        const vaultPath = getVaultPath();
        const searchPath = folder ? safePath(vaultPath, folder) : vaultPath;
        if (!fs.existsSync(searchPath)) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Folder not found: ${folder}`, matches: [] }) }] };

        let regex: RegExp;
        try {
          regex = new RegExp(pattern, "gim");
        } catch (e: any) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Invalid regex pattern: ${e.message}`, matches: [] }) }] };
        }

        const matches: any[] = [];
        for (const mdFile of findMarkdownFiles(searchPath)) {
          try {
            const content = fs.readFileSync(mdFile, "utf-8");
            const matchList: any[] = [];
            let m: RegExpExecArray | null;
            while ((m = regex.exec(content)) !== null) {
              matchList.push({
                line: content.slice(0, m.index).split("\n").length,
                match: m[0],
                start: m.index,
                end: m.index + m[0].length,
              });
            }
            if (matchList.length > 0) {
              matches.push({
                name: stem(mdFile),
                path: relPath(vaultPath, mdFile),
                matches: matchList.slice(0, 10),
                total_matches: matchList.length,
              });
            }
          } catch { continue; }
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ pattern, folder: folder || "root", total_files_matched: matches.length, matches }),
          }],
        };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message, matches: [] }) }] };
      }
    }
  );

  server.tool(
    "search_by_date_range",
    "Search for notes created or modified within a date range",
    {
      start_date: z.string().describe("Start date in YYYY-MM-DD format"),
      end_date: z.string().optional().describe("End date in YYYY-MM-DD format (defaults to today)"),
      folder: z.string().optional().describe("Optional folder path to limit search"),
    },
    async ({ start_date, end_date, folder }) => {
      try {
        const vaultPath = getVaultPath();
        const searchPath = folder ? safePath(vaultPath, folder) : vaultPath;
        if (!fs.existsSync(searchPath)) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Folder not found: ${folder}`, matches: [] }) }] };

        const start = new Date(start_date + "T00:00:00");
        const end = end_date ? new Date(end_date + "T23:59:59") : new Date();
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Invalid date format. Use YYYY-MM-DD", matches: [] }) }] };
        }

        const matches: any[] = [];
        for (const mdFile of findMarkdownFiles(searchPath)) {
          try {
            const stat = fs.statSync(mdFile);
            const modified = stat.mtime;
            const created = stat.birthtime;
            if ((modified >= start && modified <= end) || (created >= start && created <= end)) {
              matches.push({
                name: stem(mdFile),
                path: relPath(vaultPath, mdFile),
                created: created.toISOString().replace("T", " ").slice(0, 19),
                modified: modified.toISOString().replace("T", " ").slice(0, 19),
              });
            }
          } catch { continue; }
        }

        matches.sort((a, b) => b.modified.localeCompare(a.modified));
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ start_date, end_date: end_date || new Date().toISOString().slice(0, 10), folder: folder || "root", total_matches: matches.length, matches }),
          }],
        };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message, matches: [] }) }] };
      }
    }
  );

  server.tool(
    "fuzzy_search_note",
    "Fuzzy search for notes by name",
    {
      query: z.string().describe("Search query (characters in order)"),
      folder: z.string().optional().describe("Optional folder path to limit search"),
      limit: z.number().default(20).describe("Maximum number of results to return"),
    },
    async ({ query, folder, limit }) => {
      try {
        const vaultPath = getVaultPath();
        const searchPath = folder ? safePath(vaultPath, folder) : vaultPath;
        if (!fs.existsSync(searchPath)) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Folder not found: ${folder}`, matches: [] }) }] };

        const matches: any[] = [];
        for (const mdFile of findMarkdownFiles(searchPath)) {
          const noteName = stem(mdFile);
          if (fuzzyMatch(query, noteName)) {
            matches.push({ name: noteName, path: relPath(vaultPath, mdFile) });
            if (matches.length >= limit) break;
          }
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ query, folder: folder || "root", total_matches: matches.length, matches }),
          }],
        };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message, matches: [] }) }] };
      }
    }
  );
}
