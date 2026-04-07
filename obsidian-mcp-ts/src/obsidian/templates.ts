import fs from "fs";
import path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getVaultPath } from "./vault.js";
import { relPath } from "./utils.js";

export function getTemplatesFolder(): string {
  const vaultPath = getVaultPath();
  const candidates = [
    path.join(vaultPath, ".templates"),
    path.join(vaultPath, "Templates"),
    path.join(vaultPath, "templates"),
  ];

  for (const folder of candidates) {
    if (fs.existsSync(folder)) return folder;
  }

  const defaultFolder = path.join(vaultPath, "Templates");
  fs.mkdirSync(defaultFolder, { recursive: true });
  return defaultFolder;
}

export function renderTemplate(templateContent: string, variables: Record<string, string>): string {
  let content = templateContent;

  for (const [key, value] of Object.entries(variables)) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    content = content.replace(new RegExp(`\\{\\{${escaped}\\}\\}`, "g"), value);
  }

  const now = new Date();
  const dateVars: Record<string, string> = {
    date: now.toISOString().slice(0, 10),
    time: now.toTimeString().slice(0, 8),
    datetime: `${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 8)}`,
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1).padStart(2, "0"),
    day: String(now.getDate()).padStart(2, "0"),
    weekday: now.toLocaleDateString("en-US", { weekday: "long" }),
    month_name: now.toLocaleDateString("en-US", { month: "long" }),
  };

  for (const [key, value] of Object.entries(dateVars)) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    content = content.replace(new RegExp(`\\{\\{${escaped}\\}\\}`, "g"), value);
  }

  return content;
}

export function registerTemplateTools(server: McpServer) {
  server.tool(
    "list_templates",
    "List all available templates in the vault",
    {},
    async () => {
      try {
        const vaultPath = getVaultPath();
        const templatesFolder = getTemplatesFolder();

        const templates: any[] = [];
        for (const file of fs.readdirSync(templatesFolder)) {
          if (!file.endsWith(".md")) continue;
          const filePath = path.join(templatesFolder, file);
          try {
            const content = fs.readFileSync(filePath, "utf-8");
            templates.push({
              name: path.basename(file, ".md"),
              path: relPath(vaultPath, filePath),
              size: content.length,
              preview: content.length > 200 ? content.slice(0, 200) + "..." : content,
            });
          } catch { continue; }
        }

        templates.sort((a, b) => a.name.localeCompare(b.name));
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ templates_folder: relPath(vaultPath, templatesFolder), total_templates: templates.length, templates }),
          }],
        };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message, templates: [] }) }] };
      }
    }
  );

  server.tool(
    "create_note_from_template",
    "Create a new note from a template",
    {
      template_name: z.string().describe("Name of the template (without .md extension)"),
      note_name: z.string().describe("Name for the new note (without .md extension)"),
      variables: z.record(z.string()).optional().describe("Optional dictionary of variables to substitute"),
      folder: z.string().optional().describe("Optional folder path to create note in"),
    },
    async ({ template_name, note_name, variables, folder }) => {
      try {
        const vaultPath = getVaultPath();
        const templatesFolder = getTemplatesFolder();
        const templatePath = path.join(templatesFolder, `${template_name}.md`);

        if (!fs.existsSync(templatePath)) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Template not found: ${template_name}` }) }] };
        }

        const templateContent = fs.readFileSync(templatePath, "utf-8");
        const rendered = renderTemplate(templateContent, variables || {});

        let notePath: string;
        if (folder) {
          const noteDir = path.join(vaultPath, folder);
          fs.mkdirSync(noteDir, { recursive: true });
          notePath = path.join(noteDir, `${note_name}.md`);
        } else {
          notePath = path.join(vaultPath, `${note_name}.md`);
        }

        if (fs.existsSync(notePath)) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Note already exists: ${note_name}` }) }] };
        }

        fs.writeFileSync(notePath, rendered, "utf-8");
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ success: true, template_name, note_name, path: relPath(vaultPath, notePath), size: rendered.length }),
          }],
        };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message }) }] };
      }
    }
  );

  server.tool(
    "save_template",
    "Save a template to the templates folder",
    {
      template_name: z.string().describe("Name of the template (without .md extension)"),
      content: z.string().describe("Template content with {{variable}} placeholders"),
    },
    async ({ template_name, content }) => {
      try {
        const vaultPath = getVaultPath();
        const templatesFolder = getTemplatesFolder();
        const templatePath = path.join(templatesFolder, `${template_name}.md`);
        fs.writeFileSync(templatePath, content, "utf-8");
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ success: true, template_name, path: relPath(vaultPath, templatePath), size: content.length }),
          }],
        };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message }) }] };
      }
    }
  );

  server.tool(
    "get_template",
    "Get a template's content",
    { template_name: z.string().describe("Name of the template (without .md extension)") },
    async ({ template_name }) => {
      try {
        const templatesFolder = getTemplatesFolder();
        const templatePath = path.join(templatesFolder, `${template_name}.md`);

        if (!fs.existsSync(templatePath)) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Template not found: ${template_name}` }) }] };
        }

        const content = fs.readFileSync(templatePath, "utf-8");
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ template_name, content, size: content.length, lines: content.split("\n").length }),
          }],
        };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message }) }] };
      }
    }
  );
}
