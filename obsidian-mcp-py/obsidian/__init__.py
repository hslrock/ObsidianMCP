"""
Obsidian MCP Tools

This package provides MCP tools for interacting with Obsidian vaults.
Organized by domain for easy extension.
"""

from obsidian.vault import get_vault_path
from obsidian.notes import register_note_tools
from obsidian.tags import register_tag_tools
from obsidian.links import register_link_tools
from obsidian.templates import register_template_tools
from obsidian.daily_notes import register_daily_note_tools
from obsidian.statistics import register_statistics_tools
from obsidian.folders import register_folder_tools
from obsidian.advanced_search import register_advanced_search_tools
from obsidian.embeds import register_embed_tools

__all__ = [
    "get_vault_path",
    "register_note_tools",
    "register_tag_tools",
    "register_link_tools",
    "register_template_tools",
    "register_daily_note_tools",
    "register_statistics_tools",
    "register_folder_tools",
    "register_frontmatter_tools",
    "register_advanced_search_tools",
    "register_embed_tools",
]
