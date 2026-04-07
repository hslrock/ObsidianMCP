import fs from "fs";
import path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getVaultPath } from "./vault.js";
import { findMarkdownFiles, resolveNotePath, relPath, stem } from "./utils.js";

export function registerNoteTools(server: McpServer) {
  server.tool(
    "read_obsidian_note",
    "Read a note from Obsidian vault",
    { note_name: z.string().describe("Name of the note (without .md extension) or full path relative to vault") },
    async ({ note_name }) => {
      try {
        const vaultPath = getVaultPath();
        const notePath = resolveNotePath(vaultPath, note_name);

        if (!notePath) {
          const suggestions: string[] = [];
          for (const mdFile of findMarkdownFiles(vaultPath)) {
            if (stem(mdFile).toLowerCase().includes(note_name.toLowerCase())) {
              suggestions.push(stem(mdFile));
              if (suggestions.length >= 5) break;
            }
          }
          return { content: [{ type: "text", text: JSON.stringify({ error: `Note not found: ${note_name}`, suggestions }) }] };
        }

        const content = fs.readFileSync(notePath, "utf-8");
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              note_name: stem(notePath),
              path: relPath(vaultPath, notePath),
              content,
              size: content.length,
              lines: content.split("\n").length,
            }),
          }],
        };
      } catch (e: any) {
        return { content: [{ type: "text", text: JSON.stringify({ error: e.message }) }] };
      }
    }
  );

  server.tool(
    "create_obsidian_note",
    "Create a new note in Obsidian vault",
    {
      note_name: z.string().describe("Name of the note (without .md extension)"),
      content: z.string().describe("Content of the note in markdown format"),
      folder: z.string().optional().describe("Optional folder path within vault"),
    },
    async ({ note_name, content, folder }) => {
      try {
        const vaultPath = getVaultPath();
        let notePath: string;

        if (folder) {
          const noteDir = path.join(vaultPath, folder);
          fs.mkdirSync(noteDir, { recursive: true });
          notePath = path.join(noteDir, `${note_name}.md`);
        } else {
          notePath = path.join(vaultPath, `${note_name}.md`);
        }

        if (fs.existsSync(notePath)) {
          return { content: [{ type: "text", text: JSON.stringify({ error: `Note already exists: ${note_name}` }) }] };
        }

        fs.writeFileSync(notePath, content, "utf-8");
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ success: true, note_name, path: relPath(vaultPath, notePath), size: content.length }),
          }],
        };
      } catch (e: any) {
        return { content: [{ type: "text", text: JSON.stringify({ error: e.message }) }] };
      }
    }
  );

  server.tool(
    "update_obsidian_note",
    "Update an existing note in Obsidian vault",
    {
      note_name: z.string().describe("Name of the note (without .md extension) or relative path"),
      content: z.string().describe("New content or content to append"),
      append: z.boolean().default(false).describe("If true, append to existing content; if false, replace"),
    },
    async ({ note_name, content, append }) => {
      try {
        const vaultPath = getVaultPath();
        const notePath = resolveNotePath(vaultPath, note_name);

        if (!notePath) {
          return { content: [{ type: "text", text: JSON.stringify({ error: `Note not found: ${note_name}` }) }] };
        }

        let newContent: string;
        if (append) {
          const existing = fs.readFileSync(notePath, "utf-8");
          newContent = existing + "\n\n" + content;
        } else {
          newContent = content;
        }

        fs.writeFileSync(notePath, newContent, "utf-8");
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              note_name: stem(notePath),
              path: relPath(vaultPath, notePath),
              size: newContent.length,
              appended: append,
            }),
          }],
        };
      } catch (e: any) {
        return { content: [{ type: "text", text: JSON.stringify({ error: e.message }) }] };
      }
    }
  );

  server.tool(
    "list_obsidian_notes",
    "List all notes in Obsidian vault",
    { folder: z.string().optional().describe("Optional folder path to list notes from") },
    async ({ folder }) => {
      try {
        const vaultPath = getVaultPath();
        const searchPath = folder ? path.join(vaultPath, folder) : vaultPath;

        if (!fs.existsSync(searchPath)) {
          return { content: [{ type: "text", text: JSON.stringify({ error: `Folder not found: ${folder}`, notes: [] }) }] };
        }

        const notes = findMarkdownFiles(searchPath).map((mdFile) => ({
          name: stem(mdFile),
          path: relPath(vaultPath, mdFile),
          size: fs.statSync(mdFile).size,
        }));

        notes.sort((a, b) => a.path.localeCompare(b.path));

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ vault_path: vaultPath, folder: folder || "root", total_notes: notes.length, notes }),
          }],
        };
      } catch (e: any) {
        return { content: [{ type: "text", text: JSON.stringify({ error: e.message }) }] };
      }
    }
  );

  server.tool(
    "search_obsidian_notes",
    "Search for notes containing specific text",
    {
      query: z.string().describe("Text to search for in note content"),
      folder: z.string().optional().describe("Optional folder path to limit search"),
    },
    async ({ query, folder }) => {
      try {
        const vaultPath = getVaultPath();
        const searchPath = folder ? path.join(vaultPath, folder) : vaultPath;

        if (!fs.existsSync(searchPath)) {
          return { content: [{ type: "text", text: JSON.stringify({ error: `Folder not found: ${folder}`, matches: [] }) }] };
        }

        const queryLower = query.toLowerCase();
        const matches: any[] = [];

        for (const mdFile of findMarkdownFiles(searchPath)) {
          try {
            const content = fs.readFileSync(mdFile, "utf-8");
            if (content.toLowerCase().includes(queryLower)) {
              const lines = content.split("\n");
              const matchingLines = lines
                .map((line, i) => (line.toLowerCase().includes(queryLower) ? i + 1 : -1))
                .filter((n) => n !== -1);

              matches.push({
                name: stem(mdFile),
                path: relPath(vaultPath, mdFile),
                matching_lines: matchingLines.slice(0, 5),
                total_matches: matchingLines.length,
              });
            }
          } catch {
            continue;
          }
        }

        matches.sort((a, b) => b.total_matches - a.total_matches);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ query, folder: folder || "root", total_matches: matches.length, matches }),
          }],
        };
      } catch (e: any) {
        return { content: [{ type: "text", text: JSON.stringify({ error: e.message }) }] };
      }
    }
  );
}
