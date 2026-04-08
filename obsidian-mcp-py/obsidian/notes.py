"""
Obsidian Notes Management

Provides tools for creating, reading, updating, listing, and searching notes.
"""

from pathlib import Path
from typing import Optional
from obsidian.vault import get_vault_path, safe_path


def register_note_tools(mcp):
    """
    Register all note-related MCP tools.
    
    Args:
        mcp: FastMCP instance to register tools with
    """
    
    @mcp.tool()
    def read_obsidian_note(note_name: str) -> dict:
        """
        Read a note from Obsidian vault.
        
        Args:
            note_name: Name of the note (without .md extension) or full path relative to vault
        
        Returns:
            Dictionary with note content and metadata
        """
        try:
            vault_path = get_vault_path()
            note_path = safe_path(vault_path, f"{note_name}.md")
            
            # If not found, try as relative path
            if not note_path.exists():
                note_path = safe_path(vault_path, note_name)
            
            if not note_path.exists():
                # Try to find similar note names
                suggestions = []
                try:
                    for md_file in vault_path.rglob("*.md"):
                        if ".obsidian" in md_file.parts:
                            continue
                        if note_name.lower() in md_file.stem.lower():
                            suggestions.append(md_file.stem)
                            if len(suggestions) >= 5:
                                break
                except Exception:
                    pass
                
                return {
                    "error": f"Note not found: {note_name}",
                    "suggestions": suggestions
                }
            
            content = note_path.read_text(encoding="utf-8")
            
            return {
                "note_name": note_path.stem,
                "path": str(note_path.relative_to(vault_path)),
                "content": content,
                "size": len(content),
                "lines": len(content.splitlines())
            }
        except Exception as e:
            return {"error": str(e)}
    
    
    @mcp.tool()
    def create_obsidian_note(note_name: str, content: str, folder: Optional[str] = None) -> dict:
        """
        Create a new note in Obsidian vault.
        
        Args:
            note_name: Name of the note (without .md extension)
            content: Content of the note in markdown format
            folder: Optional folder path within vault (e.g., "Projects" or "Projects/Tasks")
        
        Returns:
            Dictionary with creation status
        """
        try:
            vault_path = get_vault_path()
            
            if folder:
                note_dir = safe_path(vault_path, folder)
                note_dir.mkdir(parents=True, exist_ok=True)
                note_path = note_dir / f"{note_name}.md"
            else:
                note_path = safe_path(vault_path, f"{note_name}.md")
            
            if note_path.exists():
                return {"error": f"Note already exists: {note_name}"}
            
            note_path.write_text(content, encoding="utf-8")
            
            return {
                "success": True,
                "note_name": note_name,
                "path": str(note_path.relative_to(vault_path)),
                "size": len(content)
            }
        except Exception as e:
            return {"error": str(e)}
    
    
    @mcp.tool()
    def update_obsidian_note(
        note_name: str,
        old_text: Optional[str] = None,
        new_text: Optional[str] = None,
        insert_position: Optional[str] = None,
    ) -> dict:
        """
        Update an existing note in Obsidian vault. Supports partial patch (old_text→new_text) and insert (top/bottom).

        Args:
            note_name: Name of the note (without .md extension) or relative path
            old_text: Text to find and replace (for patch mode)
            new_text: Replacement text (for patch mode) or content to insert
            insert_position: Insert new_text at "top" or "bottom" of note (omit for patch mode)

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

            existing = note_path.read_text(encoding="utf-8")

            if insert_position:
                if not new_text:
                    return {"error": "new_text is required for insert mode"}
                if insert_position == "top":
                    new_content = new_text + "\n\n" + existing
                elif insert_position == "bottom":
                    new_content = existing + "\n\n" + new_text
                else:
                    return {"error": "insert_position must be 'top' or 'bottom'"}
                mode = f"insert_{insert_position}"
            elif old_text is not None:
                if new_text is None:
                    return {"error": "new_text is required for patch mode"}
                if old_text not in existing:
                    return {"error": "old_text not found in note", "note_name": note_path.stem}
                new_content = existing.replace(old_text, new_text, 1)
                mode = "patch"
            else:
                return {"error": "Provide old_text+new_text (patch) or insert_position+new_text (insert)"}

            note_path.write_text(new_content, encoding="utf-8")
            diff = len(new_content) - len(existing)

            return {
                "success": True,
                "note_name": note_path.stem,
                "path": str(note_path.relative_to(vault_path)),
                "mode": mode,
                "chars_before": len(existing),
                "chars_after": len(new_content),
                "chars_diff": f"+{diff}" if diff >= 0 else str(diff),
            }
        except Exception as e:
            return {"error": str(e)}
    
    
    @mcp.tool()
    def list_obsidian_notes(folder: Optional[str] = None) -> dict:
        """
        List all notes in Obsidian vault.
        
        Args:
            folder: Optional folder path to list notes from (e.g., "Projects")
        
        Returns:
            Dictionary with list of notes
        """
        try:
            vault_path = get_vault_path()
            
            if folder:
                search_path = safe_path(vault_path, folder)
            else:
                search_path = vault_path
            
            if not search_path.exists():
                return {"error": f"Folder not found: {folder}", "notes": []}
            
            notes = []
            for md_file in search_path.rglob("*.md"):
                # Skip hidden directories and .obsidian folder
                if ".obsidian" in md_file.parts:
                    continue
                
                rel_path = md_file.relative_to(vault_path)
                notes.append({
                    "name": md_file.stem,
                    "path": str(rel_path),
                    "size": md_file.stat().st_size
                })
            
            notes.sort(key=lambda x: x["path"])
            
            return {
                "vault_path": str(vault_path),
                "folder": folder or "root",
                "total_notes": len(notes),
                "notes": notes
            }
        except Exception as e:
            return {"error": str(e)}
    
    
    @mcp.tool()
    def search_obsidian_notes(query: str, folder: Optional[str] = None) -> dict:
        """
        Search for notes containing specific text in Obsidian vault.
        
        Args:
            query: Text to search for in note content
            folder: Optional folder path to limit search (e.g., "Projects")
        
        Returns:
            Dictionary with matching notes
        """
        try:
            vault_path = get_vault_path()
            
            if folder:
                search_path = safe_path(vault_path, folder)
            else:
                search_path = vault_path
            
            if not search_path.exists():
                return {"error": f"Folder not found: {folder}", "matches": []}
            
            matches = []
            query_lower = query.lower()
            
            for md_file in search_path.rglob("*.md"):
                # Skip hidden directories and .obsidian folder
                if ".obsidian" in md_file.parts:
                    continue
                
                try:
                    content = md_file.read_text(encoding="utf-8")
                    if query_lower in content.lower():
                        rel_path = md_file.relative_to(vault_path)
                        # Find line numbers with matches
                        lines = content.splitlines()
                        matching_lines = [
                            i + 1 for i, line in enumerate(lines)
                            if query_lower in line.lower()
                        ]
                        
                        matches.append({
                            "name": md_file.stem,
                            "path": str(rel_path),
                            "matching_lines": matching_lines[:5],  # First 5 matches
                            "total_matches": len(matching_lines)
                        })
                except Exception:
                    continue
            
            matches.sort(key=lambda x: x["total_matches"], reverse=True)
            
            return {
                "query": query,
                "folder": folder or "root",
                "total_matches": len(matches),
                "matches": matches
            }
        except Exception as e:
            return {"error": str(e)}
