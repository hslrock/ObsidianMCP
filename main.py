"""
Obsidian MCP Server

MCP server for interacting with Obsidian vaults.
Organized by domain modules for easy extension.
"""

import sys
from mcp.server import FastMCP
from pydantic import BaseModel
import json

# Create FastMCP instance
mcp = FastMCP("Obsidian MCP Server")

# Register Obsidian domain tools
try:
    from obsidian import (
        register_note_tools,
        register_tag_tools,
        register_link_tools,
        register_template_tools,
        register_daily_note_tools,
        register_statistics_tools,
        register_folder_tools,
        register_advanced_search_tools,
        register_embed_tools,
        get_vault_path
    )
    
    # Register all tool modules
    register_note_tools(mcp)
    register_tag_tools(mcp)
    register_link_tools(mcp)
    register_template_tools(mcp)
    register_daily_note_tools(mcp)
    register_statistics_tools(mcp)
    register_folder_tools(mcp)
    register_advanced_search_tools(mcp)
    register_embed_tools(mcp)
    
except Exception as e:
    # Print error to stderr so it appears in logs
    print(f"Error registering Obsidian tools: {e}", file=sys.stderr)
    sys.stderr.flush()
    raise

@mcp.tool()
def get_server_info() -> dict:
    """
    Get information about the MCP server.
    
    Returns:
        Dictionary with server information
    """
    try:
        vault_path = get_vault_path()
        vault_info = {"vault_path": str(vault_path), "exists": True}
    except Exception as e:
        vault_info = {"error": str(e)}
    
    return {
        "name": "Obsidian MCP Server",
        "version": "3.0.0",
        "tools": [
            # Note tools
            "read_obsidian_note",
            "create_obsidian_note", 
            "update_obsidian_note",
            "list_obsidian_notes",
            "search_obsidian_notes",
            # Tag tools
            "get_note_tags",
            "search_by_tag",
            "add_tag_to_note",
            "remove_tag_from_note",
            "list_all_tags",
            # Link tools
            "get_note_links",
            "get_backlinks",
            "create_link_between_notes",
            "find_orphaned_notes",
            "find_broken_links",
            # Template tools
            "list_templates",
            "create_note_from_template",
            "save_template",
            "get_template",
            # Daily note tools
            "create_daily_note",
            "get_daily_note",
            "list_daily_notes",
            # Statistics tools
            "get_vault_statistics",
            "get_note_statistics",
            "find_most_linked_notes",
            "get_note_graph_data",
            # Folder tools
            "create_folder",
            "move_note",
            "list_folders",
            "get_folder_statistics",
            "delete_folder",
            # Frontmatter tools
            "get_note_frontmatter",
            "update_note_frontmatter",
            "remove_note_frontmatter",
            "search_by_frontmatter",
            # Advanced search tools
            "search_by_regex",
            "search_by_date_range",
            "fuzzy_search_note",
            "search_by_content_and_metadata",
            # Bulk operation tools
            "bulk_update_notes",
            "bulk_add_tag",
            "bulk_remove_tag",
            "bulk_move_notes",
            "bulk_delete_notes",
            # Embed and block tools
            "get_note_blocks",
            "update_block",
            "embed_note",
            "get_note_embeds",
            "remove_embed",
            # Server info
            "get_server_info"
        ],
        "vault": vault_info,
        "status": "running"
    }


# ============================================================================
# MCP Resources
# ============================================================================

# ============================================================================
# MCP Prompts
# ============================================================================


# ============================================================================
# FastAPI Routes (for HTTP access)
# ============================================================================
# Add custom FastAPI routes here if needed


if __name__ == "__main__":
    import uvicorn
    try:
        # Print startup message to stderr for debugging
        print("Starting Obsidian MCP Server...", file=sys.stderr)
        sys.stderr.flush()
        # Run the FastMCP server
        mcp.run()
    except Exception as e:
        print(f"Error running MCP server: {e}", file=sys.stderr)
        sys.stderr.flush()
        raise
