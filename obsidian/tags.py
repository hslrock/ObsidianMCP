"""
Obsidian Tags Management

Provides tools for managing tags in Obsidian notes.
"""

import re
from pathlib import Path
from typing import List, Optional
from obsidian.vault import get_vault_path


def extract_tags(content: str) -> List[str]:
    """
    Extract all tags from note content.
    
    Tags can be in format:
    - #tag
    - #tag/subtag
    - [[#tag]]
    
    Args:
        content: Note content as string
        
    Returns:
        List of unique tags found
    """
    tags = set()
    
    # Match #tag or #tag/subtag format
    tag_pattern = r'#([a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*)'
    matches = re.findall(tag_pattern, content)
    tags.update(matches)
    
    # Match [[#tag]] format
    bracket_tag_pattern = r'\[\[#([a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*)\]\]'
    bracket_matches = re.findall(bracket_tag_pattern, content)
    tags.update(bracket_matches)
    
    return sorted(list(tags))


def add_tag_to_content(content: str, tag: str) -> str:
    """
    Add a tag to note content if it doesn't already exist.
    
    Args:
        content: Note content
        tag: Tag to add (without #)
        
    Returns:
        Updated content with tag added
    """
    existing_tags = extract_tags(content)
    
    if tag in existing_tags:
        return content
    
    # Add tag at the end of content
    tag_line = f"#{tag}"
    if content.strip():
        return content.rstrip() + f"\n{tag_line}"
    else:
        return tag_line


def remove_tag_from_content(content: str, tag: str) -> str:
    """
    Remove a tag from note content.
    
    Args:
        content: Note content
        tag: Tag to remove (without #)
        
    Returns:
        Updated content with tag removed
    """
    # Remove #tag format
    content = re.sub(rf'#{re.escape(tag)}\b', '', content)
    # Remove [[#tag]] format
    content = re.sub(rf'\[\[#{re.escape(tag)}\]\]', '', content)
    
    # Clean up multiple newlines
    content = re.sub(r'\n{3,}', '\n\n', content)
    
    return content.strip()


def register_tag_tools(mcp):
    """
    Register all tag-related MCP tools.
    
    Args:
        mcp: FastMCP instance to register tools with
    """
    
    @mcp.tool()
    def get_note_tags(note_name: str) -> dict:
        """
        Extract all tags from a note.
        
        Args:
            note_name: Name of the note (without .md extension) or relative path
        
        Returns:
            Dictionary with tags found in the note
        """
        try:
            vault_path = get_vault_path()
            note_path = vault_path / f"{note_name}.md"
            
            if not note_path.exists():
                note_path = vault_path / note_name
            
            if not note_path.exists():
                return {"error": f"Note not found: {note_name}", "tags": []}
            
            content = note_path.read_text(encoding="utf-8")
            tags = extract_tags(content)
            
            return {
                "note_name": note_path.stem,
                "tags": tags,
                "total_tags": len(tags)
            }
        except Exception as e:
            return {"error": str(e), "tags": []}
    
    
    @mcp.tool()
    def search_by_tag(tag: str, folder: Optional[str] = None) -> dict:
        """
        Find all notes containing a specific tag.
        
        Args:
            tag: Tag to search for (without #)
            folder: Optional folder path to limit search
        
        Returns:
            Dictionary with matching notes
        """
        try:
            vault_path = get_vault_path()
            
            if folder:
                search_path = vault_path / folder
            else:
                search_path = vault_path
            
            if not search_path.exists():
                return {"error": f"Folder not found: {folder}", "matches": []}
            
            matches = []
            tag_lower = tag.lower()
            
            for md_file in search_path.rglob("*.md"):
                if ".obsidian" in md_file.parts:
                    continue
                
                try:
                    content = md_file.read_text(encoding="utf-8")
                    note_tags = extract_tags(content)
                    
                    # Check if tag matches (case-insensitive)
                    if any(tag_lower == t.lower() for t in note_tags):
                        rel_path = md_file.relative_to(vault_path)
                        matches.append({
                            "name": md_file.stem,
                            "path": str(rel_path),
                            "tags": note_tags
                        })
                except Exception:
                    continue
            
            return {
                "tag": tag,
                "folder": folder or "root",
                "total_matches": len(matches),
                "matches": matches
            }
        except Exception as e:
            return {"error": str(e), "matches": []}
    
    
    @mcp.tool()
    def add_tag_to_note(note_name: str, tag: str) -> dict:
        """
        Add a tag to a note.
        
        Args:
            note_name: Name of the note (without .md extension) or relative path
            tag: Tag to add (without #)
        
        Returns:
            Dictionary with update status
        """
        try:
            vault_path = get_vault_path()
            note_path = vault_path / f"{note_name}.md"
            
            if not note_path.exists():
                note_path = vault_path / note_name
            
            if not note_path.exists():
                return {"error": f"Note not found: {note_name}"}
            
            content = note_path.read_text(encoding="utf-8")
            existing_tags = extract_tags(content)
            
            if tag in existing_tags:
                return {
                    "success": True,
                    "note_name": note_path.stem,
                    "message": f"Tag #{tag} already exists in note",
                    "tags": existing_tags
                }
            
            updated_content = add_tag_to_content(content, tag)
            note_path.write_text(updated_content, encoding="utf-8")
            
            return {
                "success": True,
                "note_name": note_path.stem,
                "tag_added": tag,
                "all_tags": extract_tags(updated_content)
            }
        except Exception as e:
            return {"error": str(e)}
    
    
    @mcp.tool()
    def remove_tag_from_note(note_name: str, tag: str) -> dict:
        """
        Remove a tag from a note.
        
        Args:
            note_name: Name of the note (without .md extension) or relative path
            tag: Tag to remove (without #)
        
        Returns:
            Dictionary with update status
        """
        try:
            vault_path = get_vault_path()
            note_path = vault_path / f"{note_name}.md"
            
            if not note_path.exists():
                note_path = vault_path / note_name
            
            if not note_path.exists():
                return {"error": f"Note not found: {note_name}"}
            
            content = note_path.read_text(encoding="utf-8")
            existing_tags = extract_tags(content)
            
            if tag not in existing_tags:
                return {
                    "success": True,
                    "note_name": note_path.stem,
                    "message": f"Tag #{tag} not found in note",
                    "tags": existing_tags
                }
            
            updated_content = remove_tag_from_content(content, tag)
            note_path.write_text(updated_content, encoding="utf-8")
            
            return {
                "success": True,
                "note_name": note_path.stem,
                "tag_removed": tag,
                "remaining_tags": extract_tags(updated_content)
            }
        except Exception as e:
            return {"error": str(e)}
    
    
    @mcp.tool()
    def list_all_tags(folder: Optional[str] = None) -> dict:
        """
        List all unique tags found in the vault.
        
        Args:
            folder: Optional folder path to limit search
        
        Returns:
            Dictionary with all tags and their usage counts
        """
        try:
            vault_path = get_vault_path()
            
            if folder:
                search_path = vault_path / folder
            else:
                search_path = vault_path
            
            if not search_path.exists():
                return {"error": f"Folder not found: {folder}", "tags": []}
            
            tag_counts = {}
            tag_to_notes = {}
            
            for md_file in search_path.rglob("*.md"):
                if ".obsidian" in md_file.parts:
                    continue
                
                try:
                    content = md_file.read_text(encoding="utf-8")
                    tags = extract_tags(content)
                    rel_path = md_file.relative_to(vault_path)
                    
                    for tag in tags:
                        tag_counts[tag] = tag_counts.get(tag, 0) + 1
                        if tag not in tag_to_notes:
                            tag_to_notes[tag] = []
                        tag_to_notes[tag].append({
                            "name": md_file.stem,
                            "path": str(rel_path)
                        })
                except Exception:
                    continue
            
            # Sort by usage count
            sorted_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)
            
            return {
                "folder": folder or "root",
                "total_unique_tags": len(tag_counts),
                "tags": [
                    {
                        "tag": tag,
                        "count": count,
                        "notes": tag_to_notes[tag]
                    }
                    for tag, count in sorted_tags
                ]
            }
        except Exception as e:
            return {"error": str(e), "tags": []}
