import fs from "fs";
import path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getVaultPath } from "./vault.js";
import { resolveNotePath, relPath, stem } from "./utils.js";

interface Block {
  id: string;
  type: string;
  content: string;
  line_number: number;
  level?: number;
  language?: string;
}

function extractBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  const lines = content.split("\n");
  let current: Block | null = null;
  let blockId = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^#{1,6}\s/.test(line)) {
      if (current) blocks.push(current);
      const level = line.length - line.replace(/^#+/, "").length;
      current = { id: `block_${blockId}`, type: "heading", level, content: line, line_number: i + 1 };
      blockId++;
    } else if (line.trim().startsWith("```")) {
      if (current?.type === "code") {
        current.content += "\n" + line;
        blocks.push(current);
        current = null;
      } else {
        if (current) blocks.push(current);
        const language = line.trim().slice(3) || "";
        current = { id: `block_${blockId}`, type: "code", language, content: line, line_number: i + 1 };
        blockId++;
      }
    } else if (line.trim().startsWith(">")) {
      if (current?.type === "blockquote") {
        current.content += "\n" + line;
      } else {
        if (current) blocks.push(current);
        current = { id: `block_${blockId}`, type: "blockquote", content: line, line_number: i + 1 };
        blockId++;
      }
    } else {
      if (current) {
        current.content += "\n" + line;
      } else {
        current = { id: `block_${blockId}`, type: "paragraph", content: line, line_number: i + 1 };
        blockId++;
      }
    }
  }

  if (current) blocks.push(current);
  return blocks;
}

function extractEmbeds(content: string): { note: string; heading: string | null; embed_string: string }[] {
  const embeds: { note: string; heading: string | null; embed_string: string }[] = [];
  const pattern = /!\[\[([^\]#]+)(?:#([^\]]+))?\]\]/g;
  for (const m of content.matchAll(pattern)) {
    const note = m[1].trim();
    const heading = m[2]?.trim() || null;
    embeds.push({ note, heading, embed_string: `![[${note}${heading ? "#" + heading : ""}]]` });
  }
  return embeds;
}

export function registerEmbedTools(server: McpServer) {
  server.tool(
    "get_note_blocks",
    "Extract block structure from a note",
    { note_name: z.string().describe("Name of the note (without .md extension) or relative path") },
    async ({ note_name }) => {
      try {
        const vaultPath = getVaultPath();
        const notePath = resolveNotePath(vaultPath, note_name);
        if (!notePath) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Note not found: ${note_name}` }) }] };

        const content = fs.readFileSync(notePath, "utf-8");
        const blocks = extractBlocks(content);

        const blockCounts: Record<string, number> = {};
        for (const b of blocks) blockCounts[b.type] = (blockCounts[b.type] || 0) + 1;

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ note_name: stem(notePath), total_blocks: blocks.length, block_counts: blockCounts, blocks }),
          }],
        };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message }) }] };
      }
    }
  );

  server.tool(
    "update_block",
    "Update a specific block in a note",
    {
      note_name: z.string().describe("Name of the note (without .md extension) or relative path"),
      block_id: z.string().describe("ID of the block to update (from get_note_blocks)"),
      new_content: z.string().describe("New content for the block"),
    },
    async ({ note_name, block_id, new_content }) => {
      try {
        const vaultPath = getVaultPath();
        const notePath = resolveNotePath(vaultPath, note_name);
        if (!notePath) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Note not found: ${note_name}` }) }] };

        const content = fs.readFileSync(notePath, "utf-8");
        const blocks = extractBlocks(content);
        const block = blocks.find((b) => b.id === block_id);

        if (!block) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Block not found: ${block_id}` }) }] };

        const updated = content.replace(block.content, new_content);
        fs.writeFileSync(notePath, updated, "utf-8");

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ success: true, note_name: stem(notePath), block_id, old_content: block.content, new_content }),
          }],
        };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message }) }] };
      }
    }
  );

  server.tool(
    "embed_note",
    "Embed one note into another",
    {
      target_note: z.string().describe("Note to embed into (without .md extension)"),
      source_note: z.string().describe("Note to embed (without .md extension)"),
      heading: z.string().optional().describe("Optional heading to embed specific section"),
      append: z.boolean().default(true).describe("If true, append embed; if false, prepend"),
    },
    async ({ target_note, source_note, heading, append }) => {
      try {
        const vaultPath = getVaultPath();
        const targetPath = resolveNotePath(vaultPath, target_note);
        if (!targetPath) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Target note not found: ${target_note}` }) }] };

        const sourcePath = resolveNotePath(vaultPath, source_note);
        if (!sourcePath) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Source note not found: ${source_note}` }) }] };

        const content = fs.readFileSync(targetPath, "utf-8");
        const embedStr = heading ? `![[${source_note}#${heading}]]` : `![[${source_note}]]`;

        if (content.includes(embedStr)) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, message: `Note ${source_note} is already embedded in ${target_note}`, embed: embedStr }) }] };
        }

        const updated = append ? content.trimEnd() + `\n${embedStr}` : `${embedStr}\n${content}`;
        fs.writeFileSync(targetPath, updated, "utf-8");

        return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, target_note, source_note, embed: embedStr }) }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message }) }] };
      }
    }
  );

  server.tool(
    "get_note_embeds",
    "Get all notes embedded in a note",
    { note_name: z.string().describe("Name of the note (without .md extension) or relative path") },
    async ({ note_name }) => {
      try {
        const vaultPath = getVaultPath();
        const notePath = resolveNotePath(vaultPath, note_name);
        if (!notePath) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Note not found: ${note_name}` }) }] };

        const content = fs.readFileSync(notePath, "utf-8");
        const embeds = extractEmbeds(content);

        return { content: [{ type: "text" as const, text: JSON.stringify({ note_name: stem(notePath), total_embeds: embeds.length, embeds }) }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message }) }] };
      }
    }
  );

  server.tool(
    "remove_embed",
    "Remove an embedded note from another note",
    {
      target_note: z.string().describe("Note containing the embed (without .md extension)"),
      source_note: z.string().describe("Embedded note to remove (without .md extension)"),
      heading: z.string().optional().describe("Optional heading if removing specific section embed"),
    },
    async ({ target_note, source_note, heading }) => {
      try {
        const vaultPath = getVaultPath();
        const targetPath = resolveNotePath(vaultPath, target_note);
        if (!targetPath) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Target note not found: ${target_note}` }) }] };

        const content = fs.readFileSync(targetPath, "utf-8");
        const embedStr = heading ? `![[${source_note}#${heading}]]` : `![[${source_note}]]`;

        if (!content.includes(embedStr)) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, message: `Embed not found: ${embedStr}`, target_note }) }] };
        }

        let updated = content.replace(embedStr, "").trim();
        updated = updated.replace(/\n{3,}/g, "\n\n");
        fs.writeFileSync(targetPath, updated, "utf-8");

        return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, target_note, source_note, removed_embed: embedStr }) }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message }) }] };
      }
    }
  );
}
