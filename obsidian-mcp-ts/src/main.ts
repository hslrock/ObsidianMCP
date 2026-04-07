import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  getVaultPath,
  registerNoteTools,
  registerTagTools,
  registerLinkTools,
  registerTemplateTools,
  registerDailyNoteTools,
  registerStatisticsTools,
  registerFolderTools,
  registerAdvancedSearchTools,
  registerEmbedTools,
} from "./obsidian/index.js";

const server = new McpServer({
  name: "Obsidian MCP Server",
  version: "3.0.0",
});

// Register all domain tools
registerNoteTools(server);
registerTagTools(server);
registerLinkTools(server);
registerTemplateTools(server);
registerDailyNoteTools(server);
registerStatisticsTools(server);
registerFolderTools(server);
registerAdvancedSearchTools(server);
registerEmbedTools(server);

// Server info tool
server.tool(
  "get_server_info",
  "Get information about the MCP server",
  {},
  async () => {
    let vaultInfo: Record<string, any>;
    try {
      const vaultPath = getVaultPath();
      vaultInfo = { vault_path: vaultPath, exists: true };
    } catch (e: any) {
      vaultInfo = { error: e.message };
    }

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          name: "Obsidian MCP Server",
          version: "3.0.0",
          tools: [
            "read_obsidian_note", "create_obsidian_note", "update_obsidian_note",
            "list_obsidian_notes", "search_obsidian_notes",
            "get_note_tags", "search_by_tag", "add_tag_to_note",
            "remove_tag_from_note", "list_all_tags",
            "get_note_links", "get_backlinks", "create_link_between_notes",
            "find_orphaned_notes", "find_broken_links",
            "list_templates", "create_note_from_template", "save_template", "get_template",
            "create_daily_note", "get_daily_note", "list_daily_notes",
            "get_vault_statistics", "get_note_statistics",
            "find_most_linked_notes", "get_note_graph_data",
            "create_folder", "move_note", "list_folders",
            "get_folder_statistics", "delete_folder",
            "search_by_regex", "search_by_date_range",
            "fuzzy_search_note",
            "get_note_blocks", "update_block", "embed_note",
            "get_note_embeds", "remove_embed",
            "get_server_info",
          ],
          vault: vaultInfo,
          status: "running",
        }),
      }],
    };
  }
);

// Start server
async function main() {
  console.error("Starting Obsidian MCP Server (TypeScript)...");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Obsidian MCP Server is running.");
}

main().catch((err) => {
  console.error("Error running MCP server:", err);
  process.exit(1);
});
