import fs from "fs";
import path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getVaultPath } from "./vault.js";
import { relPath } from "./utils.js";
import { getTemplatesFolder, renderTemplate } from "./templates.js";

function getDailyNotesFolder(): string {
  const vaultPath = getVaultPath();
  const candidates = [
    path.join(vaultPath, "Daily Notes"),
    path.join(vaultPath, "daily"),
    path.join(vaultPath, "Daily"),
    path.join(vaultPath, "Journal"),
  ];

  for (const folder of candidates) {
    if (fs.existsSync(folder)) return folder;
  }

  const defaultFolder = path.join(vaultPath, "Daily Notes");
  fs.mkdirSync(defaultFolder, { recursive: true });
  return defaultFolder;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDate(s: string): Date | null {
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}

function formatLongDate(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

export function registerDailyNoteTools(server: McpServer) {
  server.tool(
    "create_daily_note",
    "Create a daily note for a specific date",
    {
      note_date: z.string().optional().describe("Date in YYYY-MM-DD format (defaults to today)"),
      template: z.string().optional().describe("Optional template name to use"),
    },
    async ({ note_date, template }) => {
      try {
        const vaultPath = getVaultPath();
        const dailyFolder = getDailyNotesFolder();

        let targetDate: Date;
        if (note_date) {
          const parsed = parseDate(note_date);
          if (!parsed) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Invalid date format: ${note_date}. Use YYYY-MM-DD` }) }] };
          targetDate = parsed;
        } else {
          targetDate = new Date();
        }

        const noteName = formatDate(targetDate);
        const notePath = path.join(dailyFolder, `${noteName}.md`);

        if (fs.existsSync(notePath)) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, message: `Daily note already exists for ${note_date || "today"}`, note_name: noteName, path: relPath(vaultPath, notePath) }),
            }],
          };
        }

        let content: string;
        if (template) {
          try {
            const templatesFolder = getTemplatesFolder();
            const templatePath = path.join(templatesFolder, `${template}.md`);
            if (fs.existsSync(templatePath)) {
              const templateContent = fs.readFileSync(templatePath, "utf-8");
              content = renderTemplate(templateContent, {
                date: noteName,
                weekday: targetDate.toLocaleDateString("en-US", { weekday: "long" }),
                month_name: targetDate.toLocaleDateString("en-US", { month: "long" }),
              });
            } else {
              content = `# ${formatLongDate(targetDate)}\n\n`;
            }
          } catch {
            content = `# ${formatLongDate(targetDate)}\n\n`;
          }
        } else {
          content = `# ${formatLongDate(targetDate)}\n\n`;
        }

        fs.writeFileSync(notePath, content, "utf-8");
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ success: true, note_name: noteName, date: formatDate(targetDate), path: relPath(vaultPath, notePath), size: content.length }),
          }],
        };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message }) }] };
      }
    }
  );

  server.tool(
    "get_daily_note",
    "Get a daily note for a specific date",
    { note_date: z.string().optional().describe("Date in YYYY-MM-DD format (defaults to today)") },
    async ({ note_date }) => {
      try {
        const vaultPath = getVaultPath();
        const dailyFolder = getDailyNotesFolder();

        let targetDate: Date;
        if (note_date) {
          const parsed = parseDate(note_date);
          if (!parsed) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Invalid date format: ${note_date}. Use YYYY-MM-DD` }) }] };
          targetDate = parsed;
        } else {
          targetDate = new Date();
        }

        const noteName = formatDate(targetDate);
        const notePath = path.join(dailyFolder, `${noteName}.md`);

        if (!fs.existsSync(notePath)) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Daily note not found for ${note_date || "today"}`, note_name: noteName, date: formatDate(targetDate) }) }] };
        }

        const content = fs.readFileSync(notePath, "utf-8");
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ note_name: noteName, date: formatDate(targetDate), content, size: content.length, lines: content.split("\n").length }),
          }],
        };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message }) }] };
      }
    }
  );

  server.tool(
    "list_daily_notes",
    "List daily notes within a date range",
    {
      start_date: z.string().optional().describe("Start date in YYYY-MM-DD format (defaults to 30 days ago)"),
      end_date: z.string().optional().describe("End date in YYYY-MM-DD format (defaults to today)"),
      limit: z.number().default(50).describe("Maximum number of notes to return"),
    },
    async ({ start_date, end_date, limit }) => {
      try {
        const vaultPath = getVaultPath();
        const dailyFolder = getDailyNotesFolder();

        let end: Date;
        if (end_date) {
          const parsed = parseDate(end_date);
          if (!parsed) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Invalid end_date format: ${end_date}. Use YYYY-MM-DD` }) }] };
          end = parsed;
        } else {
          end = new Date();
        }

        let start: Date;
        if (start_date) {
          const parsed = parseDate(start_date);
          if (!parsed) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Invalid start_date format: ${start_date}. Use YYYY-MM-DD` }) }] };
          start = parsed;
        } else {
          start = new Date(end);
          start.setDate(start.getDate() - 30);
        }

        if (start > end) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ error: "start_date must be before end_date" }) }] };
        }

        const dailyNotes: any[] = [];
        const current = new Date(start);

        while (current <= end && dailyNotes.length < limit) {
          const noteName = formatDate(current);
          const notePath = path.join(dailyFolder, `${noteName}.md`);

          if (fs.existsSync(notePath)) {
            try {
              const content = fs.readFileSync(notePath, "utf-8");
              dailyNotes.push({
                note_name: noteName,
                date: formatDate(current),
                size: content.length,
                lines: content.split("\n").length,
                preview: content.length > 200 ? content.slice(0, 200) + "..." : content,
              });
            } catch { /* skip */ }
          }

          current.setDate(current.getDate() + 1);
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ start_date: formatDate(start), end_date: formatDate(end), total_found: dailyNotes.length, daily_notes: dailyNotes }),
          }],
        };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message, daily_notes: [] }) }] };
      }
    }
  );
}
