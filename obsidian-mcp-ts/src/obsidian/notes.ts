import fs from "fs";
import path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getVaultPath } from "./vault.js";
import { findMarkdownFiles, resolveNotePath, relPath, stem, safePath } from "./utils.js";

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
          const noteDir = safePath(vaultPath, folder);
          fs.mkdirSync(noteDir, { recursive: true });
          notePath = path.join(noteDir, `${note_name}.md`);
        } else {
          notePath = safePath(vaultPath, `${note_name}.md`);
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
    "Update an existing note in Obsidian vault. Supports partial patch (old_text→new_text) and insert (top/bottom).",
    {
      note_name: z.string().describe("Name of the note (without .md extension) or relative path"),
      old_text: z.string().optional().describe("Text to find and replace (for patch mode)"),
      new_text: z.string().optional().describe("Replacement text (for patch mode) or content to insert"),
      insert_position: z.enum(["top", "bottom"]).optional().describe("Insert new_text at top or bottom of note (omit for patch mode)"),
    },
    async ({ note_name, old_text, new_text, insert_position }) => {
      try {
        const vaultPath = getVaultPath();
        const notePath = resolveNotePath(vaultPath, note_name);

        if (!notePath) {
          return { content: [{ type: "text", text: JSON.stringify({ error: `Note not found: ${note_name}` }) }] };
        }

        const existing = fs.readFileSync(notePath, "utf-8");
        let newContent: string;
        let mode: string;

        if (insert_position) {
          // Insert mode: add new_text at top or bottom
          if (!new_text) {
            return { content: [{ type: "text", text: JSON.stringify({ error: "new_text is required for insert mode" }) }] };
          }
          newContent = insert_position === "top"
            ? new_text + "\n\n" + existing
            : existing + "\n\n" + new_text;
          mode = `insert_${insert_position}`;
        } else if (old_text !== undefined) {
          // Patch mode: find and replace
          if (new_text === undefined) {
            return { content: [{ type: "text", text: JSON.stringify({ error: "new_text is required for patch mode" }) }] };
          }
          if (!existing.includes(old_text)) {
            return { content: [{ type: "text", text: JSON.stringify({ error: "old_text not found in note", note_name: stem(notePath) }) }] };
          }
          newContent = existing.replace(old_text, new_text);
          mode = "patch";
        } else {
          return { content: [{ type: "text", text: JSON.stringify({ error: "Provide old_text+new_text (patch) or insert_position+new_text (insert)" }) }] };
        }

        fs.writeFileSync(notePath, newContent, "utf-8");
        const diff = newContent.length - existing.length;
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              note_name: stem(notePath),
              path: relPath(vaultPath, notePath),
              mode,
              chars_before: existing.length,
              chars_after: newContent.length,
              chars_diff: diff >= 0 ? `+${diff}` : `${diff}`,
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
        const searchPath = folder ? safePath(vaultPath, folder) : vaultPath;

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
        const searchPath = folder ? safePath(vaultPath, folder) : vaultPath;

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
