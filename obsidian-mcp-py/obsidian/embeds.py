"""
Obsidian Embeds and Blocks Management

Provides tools for managing note embeds and block-level operations.
"""

import re
from pathlib import Path
from typing import Optional, List, Dict, Any
from obsidian.vault import get_vault_path, safe_path


def extract_blocks(content: str) -> List[Dict[str, Any]]:
    """
    Extract block structure from note content.
    
    Blocks are identified by:
    - Headings (# ## ### etc.)
    - Code blocks (```)
    - Lists
    - Blockquotes (>)
    
    Args:
        content: Note content
        
    Returns:
        List of block dictionaries with type and content
    """
    blocks = []
    lines = content.splitlines()
    
    current_block = None
    block_id = 0
    
    for i, line in enumerate(lines):
        # Heading block
        if re.match(r'^#{1,6}\s', line):
            if current_block:
                blocks.append(current_block)
            
            level = len(line) - len(line.lstrip('#'))
            current_block = {
                "id": f"block_{block_id}",
                "type": "heading",
                "level": level,
                "content": line,
                "line_number": i + 1
            }
            block_id += 1
            
        # Code block start/end
        elif line.strip().startswith('```'):
            if current_block and current_block.get("type") == "code":
                current_block["content"] += "\n" + line
                blocks.append(current_block)
                current_block = None
            else:
                if current_block:
                    blocks.append(current_block)
                language = line.strip()[3:] if len(line.strip()) > 3 else ""
                current_block = {
                    "id": f"block_{block_id}",
                    "type": "code",
                    "language": language,
                    "content": line,
                    "line_number": i + 1
                }
                block_id += 1
        
        # Blockquote
        elif line.strip().startswith('>'):
            if current_block and current_block.get("type") == "blockquote":
                current_block["content"] += "\n" + line
            else:
                if current_block:
                    blocks.append(current_block)
                current_block = {
                    "id": f"block_{block_id}",
                    "type": "blockquote",
                    "content": line,
                    "line_number": i + 1
                }
                block_id += 1
        
        # Regular content
        else:
            if current_block:
                if current_block.get("type") in ["code", "blockquote"]:
                    current_block["content"] += "\n" + line
                else:
                    current_block["content"] += "\n" + line
            else:
                # Start a new paragraph block
                current_block = {
                    "id": f"block_{block_id}",
                    "type": "paragraph",
                    "content": line,
                    "line_number": i + 1
                }
                block_id += 1
    
    if current_block:
        blocks.append(current_block)
    
    return blocks


def extract_embeds(content: str) -> List[Dict[str, str]]:
    """
    Extract embedded notes from content.
    
    Embeds are in format: ![[Note Name]] or ![[Note Name#Heading]]
    
    Args:
        content: Note content
        
    Returns:
        List of embedded note dictionaries
    """
    embeds = []
    
    # Match ![[Note Name]] or ![[Note Name#Heading]]
    embed_pattern = r'!\[\[([^\]#]+)(?:#([^\]]+))?\]\]'
    matches = re.findall(embed_pattern, content)
    
    for match in matches:
        note_name = match[0].strip()
        heading = match[1].strip() if match[1] else None
        
        embeds.append({
            "note": note_name,
            "heading": heading,
            "embed_string": f"![[{note_name}{'#' + heading if heading else ''}]]"
        })
    
    return embeds


def register_embed_tools(mcp):
    """
    Register all embed and block-related MCP tools.
    
    Args:
        mcp: FastMCP instance to register tools with
    """
    
    @mcp.tool()
    def get_note_blocks(note_name: str) -> dict:
        """
        Extract block structure from a note.
        
        Args:
            note_name: Name of the note (without .md extension) or relative path
        
        Returns:
            Dictionary with block structure
        """
        try:
            vault_path = get_vault_path()
            note_path = safe_path(vault_path, f"{note_name}.md")
            
            if not note_path.exists():
                note_path = safe_path(vault_path, note_name)
            
            if not note_path.exists():
                return {"error": f"Note not found: {note_name}"}
            
            content = note_path.read_text(encoding="utf-8")
            blocks = extract_blocks(content)
            
            # Count blocks by type
            block_counts = {}
            for block in blocks:
                block_type = block["type"]
                block_counts[block_type] = block_counts.get(block_type, 0) + 1
            
            return {
                "note_name": note_path.stem,
                "total_blocks": len(blocks),
                "block_counts": block_counts,
                "blocks": blocks
            }
        except Exception as e:
            return {"error": str(e)}
    
    
    @mcp.tool()
    def update_block(note_name: str, block_id: str, new_content: str) -> dict:
        """
        Update a specific block in a note.
        
        Args:
            note_name: Name of the note (without .md extension) or relative path
            block_id: ID of the block to update (from get_note_blocks)
            new_content: New content for the block
        
        Returns:
            Dictionary with update status
        """
        try:
            vault_path = get_vault_path()
            note_path = safe_path(vault_path, f"{note_name}.md")
            
            if not note_path.exists():
                note_path = safe_path(vault_path, note_name)
            
            if not note_path.exists():
                return {"error": f"Note not found: {note_name}"}
            
            content = note_path.read_text(encoding="utf-8")
            blocks = extract_blocks(content)
            
            # Find the block to update
            block_to_update = None
            for block in blocks:
                if block["id"] == block_id:
                    block_to_update = block
                    break
            
            if not block_to_update:
                return {"error": f"Block not found: {block_id}"}
            
            # Replace block content in original content
            # This is a simplified approach - in practice, you'd want more precise replacement
            old_block_content = block_to_update["content"]
            updated_content = content.replace(old_block_content, new_content, 1)
            
            note_path.write_text(updated_content, encoding="utf-8")
            
            return {
                "success": True,
                "note_name": note_path.stem,
                "block_id": block_id,
                "old_content": old_block_content,
                "new_content": new_content
            }
        except Exception as e:
            return {"error": str(e)}
    
    
    @mcp.tool()
    def embed_note(target_note: str, source_note: str, heading: Optional[str] = None, append: bool = True) -> dict:
        """
        Embed one note into another.
        
        Args:
            target_note: Note to embed into (without .md extension)
            source_note: Note to embed (without .md extension)
            heading: Optional heading to embed specific section
            append: If True, append embed; if False, prepend
        
        Returns:
            Dictionary with embed status
        """
        try:
            vault_path = get_vault_path()
            target_path = safe_path(vault_path, f"{target_note}.md")
            
            if not target_path.exists():
                target_path = safe_path(vault_path, target_note)
            
            if not target_path.exists():
                return {"error": f"Target note not found: {target_note}"}
            
            # Check if source note exists
            source_path = safe_path(vault_path, f"{source_note}.md")
            if not source_path.exists():
                source_path = safe_path(vault_path, source_note)
            
            if not source_path.exists():
                return {"error": f"Source note not found: {source_note}"}
            
            content = target_path.read_text(encoding="utf-8")
            
            # Create embed string
            if heading:
                embed_str = f"![[{source_note}#{heading}]]"
            else:
                embed_str = f"![[{source_note}]]"
            
            # Check if already embedded
            if embed_str in content:
                return {
                    "success": True,
                    "message": f"Note {source_note} is already embedded in {target_note}",
                    "embed": embed_str
                }
            
            # Add embed
            if append:
                updated_content = content.rstrip() + f"\n{embed_str}"
            else:
                updated_content = f"{embed_str}\n{content}"
            
            target_path.write_text(updated_content, encoding="utf-8")
            
            return {
                "success": True,
                "target_note": target_note,
                "source_note": source_note,
                "embed": embed_str
            }
        except Exception as e:
            return {"error": str(e)}
    
    
    @mcp.tool()
    def get_note_embeds(note_name: str) -> dict:
        """
        Get all notes embedded in a note.
        
        Args:
            note_name: Name of the note (without .md extension) or relative path
        
        Returns:
            Dictionary with embedded notes
        """
        try:
            vault_path = get_vault_path()
            note_path = safe_path(vault_path, f"{note_name}.md")
            
            if not note_path.exists():
                note_path = safe_path(vault_path, note_name)
            
            if not note_path.exists():
                return {"error": f"Note not found: {note_name}"}
            
            content = note_path.read_text(encoding="utf-8")
            embeds = extract_embeds(content)
            
            return {
                "note_name": note_path.stem,
                "total_embeds": len(embeds),
                "embeds": embeds
            }
        except Exception as e:
            return {"error": str(e)}
    
    
    @mcp.tool()
    def remove_embed(target_note: str, source_note: str, heading: Optional[str] = None) -> dict:
        """
        Remove an embedded note from another note.
        
        Args:
            target_note: Note containing the embed (without .md extension)
            source_note: Embedded note to remove (without .md extension)
            heading: Optional heading if removing specific section embed
        
        Returns:
            Dictionary with removal status
        """
        try:
            vault_path = get_vault_path()
            target_path = safe_path(vault_path, f"{target_note}.md")
            
            if not target_path.exists():
                target_path = safe_path(vault_path, target_note)
            
            if not target_path.exists():
                return {"error": f"Target note not found: {target_note}"}
            
            content = target_path.read_text(encoding="utf-8")
            
            # Create embed string to remove
            if heading:
                embed_str = f"![[{source_note}#{heading}]]"
            else:
                embed_str = f"![[{source_note}]]"
            
            if embed_str not in content:
                return {
                    "success": True,
                    "message": f"Embed not found: {embed_str}",
                    "target_note": target_note
                }
            
            # Remove embed (handle newlines)
            updated_content = content.replace(embed_str, "").strip()
            # Clean up multiple newlines
            updated_content = re.sub(r'\n{3,}', '\n\n', updated_content)
            
            target_path.write_text(updated_content, encoding="utf-8")
            
            return {
                "success": True,
                "target_note": target_note,
                "source_note": source_note,
                "removed_embed": embed_str
            }
        except Exception as e:
            return {"error": str(e)}
