import fs from "fs";
import path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getVaultPath } from "./vault.js";
import { findMarkdownFiles, resolveNotePath, relPath, stem } from "./utils.js";

function findAllDirs(dir: string, vaultPath: string): string[] {
  const results: string[] = [];
  function walk(current: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch { return; }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === ".obsidian") continue;
      const full = path.join(current, entry.name);
      results.push(path.relative(vaultPath, full));
      walk(full);
    }
  }
  walk(dir);
  return results;
}

export function registerFolderTools(server: McpServer) {
  server.tool(
    "create_folder",
    "Create a new folder in the vault",
    { folder_path: z.string().describe("Path to the folder (e.g., 'Projects/Tasks')") },
    async ({ folder_path }) => {
      try {
        const vaultPath = getVaultPath();
        const newFolder = path.join(vaultPath, folder_path);

        if (fs.existsSync(newFolder)) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, message: `Folder already exists: ${folder_path}`, folder_path }) }] };
        }

        fs.mkdirSync(newFolder, { recursive: true });
        return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, folder_path, full_path: newFolder }) }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message }) }] };
      }
    }
  );

  server.tool(
    "move_note",
    "Move a note to a different folder",
    {
      note_name: z.string().describe("Name of the note (without .md extension) or current relative path"),
      new_folder: z.string().describe("Destination folder path"),
    },
    async ({ note_name, new_folder }) => {
      try {
        const vaultPath = getVaultPath();
        const notePath = resolveNotePath(vaultPath, note_name);
        if (!notePath) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Note not found: ${note_name}` }) }] };

        const destFolder = path.join(vaultPath, new_folder);
        fs.mkdirSync(destFolder, { recursive: true });

        const destPath = path.join(destFolder, path.basename(notePath));
        if (fs.existsSync(destPath)) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Note already exists in destination: ${new_folder}/${path.basename(notePath)}` }) }] };
        }

        fs.renameSync(notePath, destPath);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ success: true, note_name: stem(notePath), old_path: relPath(vaultPath, notePath), new_path: relPath(vaultPath, destPath), new_folder }),
          }],
        };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message }) }] };
      }
    }
  );

  server.tool(
    "list_folders",
    "List all folders in the vault",
    { folder: z.string().optional().describe("Optional parent folder to list subfolders from") },
    async ({ folder }) => {
      try {
        const vaultPath = getVaultPath();
        const searchPath = folder ? path.join(vaultPath, folder) : vaultPath;
        if (!fs.existsSync(searchPath)) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Folder not found: ${folder}`, folders: [] }) }] };

        const folders = findAllDirs(searchPath, vaultPath);
        if (!folder) folders.unshift(".");
        folders.sort();

        return { content: [{ type: "text" as const, text: JSON.stringify({ parent_folder: folder || "root", total_folders: folders.length, folders }) }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message, folders: [] }) }] };
      }
    }
  );

  server.tool(
    "get_folder_statistics",
    "Get statistics about a specific folder",
    { folder: z.string().describe("Folder path (e.g., 'Projects')") },
    async ({ folder }) => {
      try {
        const vaultPath = getVaultPath();
        const folderPath = path.join(vaultPath, folder);

        if (!fs.existsSync(folderPath)) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Folder not found: ${folder}` }) }] };
        if (!fs.statSync(folderPath).isDirectory()) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Path is not a folder: ${folder}` }) }] };

        let totalNotes = 0, totalSize = 0, totalLines = 0;
        const subfolders: string[] = [];
        const noteList: any[] = [];

        for (const entry of fs.readdirSync(folderPath, { withFileTypes: true })) {
          const fullPath = path.join(folderPath, entry.name);
          if (entry.isDirectory() && entry.name !== ".obsidian") {
            subfolders.push(entry.name);
          } else if (entry.isFile() && entry.name.endsWith(".md")) {
            try {
              const content = fs.readFileSync(fullPath, "utf-8");
              totalNotes++;
              totalSize += content.length;
              const lines = content.split("\n").length;
              totalLines += lines;
              noteList.push({ name: path.basename(entry.name, ".md"), size: content.length, lines });
            } catch { continue; }
          }
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              folder,
              total_notes: totalNotes,
              total_subfolders: subfolders.length,
              subfolders: subfolders.sort(),
              total_size_bytes: totalSize,
              total_size_kb: Math.round((totalSize / 1024) * 100) / 100,
              total_lines: totalLines,
              average_note_size: totalNotes ? Math.round((totalSize / totalNotes) * 100) / 100 : 0,
              average_lines_per_note: totalNotes ? Math.round((totalLines / totalNotes) * 100) / 100 : 0,
              notes: noteList.sort((a, b) => a.name.localeCompare(b.name)),
            }),
          }],
        };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message }) }] };
      }
    }
  );

  server.tool(
    "delete_folder",
    "Delete a folder from the vault",
    {
      folder_path: z.string().describe("Path to the folder to delete"),
      force: z.boolean().default(false).describe("If true, delete folder even if it contains notes"),
    },
    async ({ folder_path, force }) => {
      try {
        const vaultPath = getVaultPath();
        const folderFull = path.join(vaultPath, folder_path);

        if (!fs.existsSync(folderFull)) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Folder not found: ${folder_path}` }) }] };
        if (!fs.statSync(folderFull).isDirectory()) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Path is not a folder: ${folder_path}` }) }] };

        const noteCount = findMarkdownFiles(folderFull).length;
        if (noteCount > 0 && !force) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Folder contains ${noteCount} note(s). Use force=true to delete anyway.`, note_count: noteCount }) }] };
        }

        fs.rmSync(folderFull, { recursive: true, force: true });
        return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, folder_path, notes_deleted: noteCount }) }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message }) }] };
      }
    }
  );
}
