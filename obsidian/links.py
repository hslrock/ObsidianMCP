"""
Obsidian Links Management

Provides tools for managing links between notes in Obsidian.
"""

import re
from pathlib import Path
from typing import List, Optional
from obsidian.vault import get_vault_path


def extract_links(content: str) -> List[str]:
    """
    Extract all note links from content.
    
    Links can be in format:
    - [[Note Name]]
    - [[Note Name|Alias]]
    - [[Note Name#Heading]]
    
    Args:
        content: Note content as string
        
    Returns:
        List of linked note names (without aliases or headings)
    """
    links = []
    
    # Match [[Note Name]] or [[Note Name|Alias]] or [[Note Name#Heading]]
    link_pattern = r'\[\[([^\]#\|]+)(?:[#\|][^\]]+)?\]\]'
    matches = re.findall(link_pattern, content)
    
    for match in matches:
        note_name = match.strip()
        if note_name:
            links.append(note_name)
    
    return links


def extract_links_with_details(content: str) -> List[dict]:
    """
    Extract all note links with details (name, alias, heading).
    
    Args:
        content: Note content as string
        
    Returns:
        List of dictionaries with link details
    """
    links = []
    
    # Match [[Note Name]], [[Note Name|Alias]], [[Note Name#Heading]], [[Note Name#Heading|Alias]]
    link_pattern = r'\[\[([^\]#\|]+)(?:#([^\|]+))?(?:\|([^\]]+))?\]\]'
    matches = re.findall(link_pattern, content)
    
    for match in matches:
        note_name = match[0].strip()
        heading = match[1].strip() if match[1] else None
        alias = match[2].strip() if match[2] else None
        
        if note_name:
            links.append({
                "note": note_name,
                "heading": heading,
                "alias": alias
            })
    
    return links


def create_link(from_note: str, to_note: str, alias: Optional[str] = None) -> str:
    """
    Create a link string.
    
    Args:
        from_note: Source note name
        to_note: Target note name
        alias: Optional alias for the link
        
    Returns:
        Link string in Obsidian format
    """
    if alias:
        return f"[[{to_note}|{alias}]]"
    else:
        return f"[[{to_note}]]"


def register_link_tools(mcp):
    """
    Register all link-related MCP tools.
    
    Args:
        mcp: FastMCP instance to register tools with
    """
    
    @mcp.tool()
    def get_note_links(note_name: str) -> dict:
        """
        Extract all links from a note.
        
        Args:
            note_name: Name of the note (without .md extension) or relative path
        
        Returns:
            Dictionary with links found in the note
        """
        try:
            vault_path = get_vault_path()
            note_path = vault_path / f"{note_name}.md"
            
            if not note_path.exists():
                note_path = vault_path / note_name
            
            if not note_path.exists():
                return {"error": f"Note not found: {note_name}", "links": []}
            
            content = note_path.read_text(encoding="utf-8")
            links = extract_links(content)
            links_with_details = extract_links_with_details(content)
            
            return {
                "note_name": note_path.stem,
                "links": links,
                "links_with_details": links_with_details,
                "total_links": len(links)
            }
        except Exception as e:
            return {"error": str(e), "links": []}
    
    
    @mcp.tool()
    def get_backlinks(note_name: str) -> dict:
        """
        Find all notes that link to a specific note.
        
        Args:
            note_name: Name of the note to find backlinks for
        
        Returns:
            Dictionary with notes that link to this note
        """
        try:
            vault_path = get_vault_path()
            target_note_path = vault_path / f"{note_name}.md"
            
            if not target_note_path.exists():
                target_note_path = vault_path / note_name
            
            if not target_note_path.exists():
                return {"error": f"Note not found: {note_name}", "backlinks": []}
            
            target_note_name = target_note_path.stem
            backlinks = []
            
            for md_file in vault_path.rglob("*.md"):
                if ".obsidian" in md_file.parts:
                    continue
                
                if md_file == target_note_path:
                    continue
                
                try:
                    content = md_file.read_text(encoding="utf-8")
                    links = extract_links(content)
                    
                    # Check if this note links to the target
                    if target_note_name in links or note_name in links:
                        rel_path = md_file.relative_to(vault_path)
                        backlinks.append({
                            "name": md_file.stem,
                            "path": str(rel_path)
                        })
                except Exception:
                    continue
            
            return {
                "note_name": note_name,
                "backlinks": backlinks,
                "total_backlinks": len(backlinks)
            }
        except Exception as e:
            return {"error": str(e), "backlinks": []}
    
    
    @mcp.tool()
    def create_link_between_notes(from_note: str, to_note: str, alias: Optional[str] = None, append: bool = True) -> dict:
        """
        Create a link from one note to another.
        
        Args:
            from_note: Source note name (without .md extension)
            to_note: Target note name (without .md extension)
            alias: Optional alias for the link
            append: If True, append link to note; if False, prepend
        
        Returns:
            Dictionary with link creation status
        """
        try:
            vault_path = get_vault_path()
            from_note_path = vault_path / f"{from_note}.md"
            
            if not from_note_path.exists():
                from_note_path = vault_path / from_note
            
            if not from_note_path.exists():
                return {"error": f"Source note not found: {from_note}"}
            
            content = from_note_path.read_text(encoding="utf-8")
            existing_links = extract_links(content)
            
            # Check if link already exists
            if to_note in existing_links:
                return {
                    "success": True,
                    "message": f"Link from {from_note} to {to_note} already exists",
                    "from_note": from_note,
                    "to_note": to_note
                }
            
            link_str = create_link(from_note, to_note, alias)
            
            if append:
                updated_content = content.rstrip() + f"\n{link_str}"
            else:
                updated_content = f"{link_str}\n{content}"
            
            from_note_path.write_text(updated_content, encoding="utf-8")
            
            return {
                "success": True,
                "from_note": from_note,
                "to_note": to_note,
                "link": link_str,
                "alias": alias
            }
        except Exception as e:
            return {"error": str(e)}
    
    
    @mcp.tool()
    def find_orphaned_notes(folder: Optional[str] = None) -> dict:
        """
        Find notes that are not linked by any other note.
        
        Args:
            folder: Optional folder path to limit search
        
        Returns:
            Dictionary with orphaned notes
        """
        try:
            vault_path = get_vault_path()
            
            if folder:
                search_path = vault_path / folder
            else:
                search_path = vault_path
            
            if not search_path.exists():
                return {"error": f"Folder not found: {folder}", "orphaned_notes": []}
            
            all_notes = set()
            linked_notes = set()
            
            # First pass: collect all notes
            for md_file in search_path.rglob("*.md"):
                if ".obsidian" in md_file.parts:
                    continue
                all_notes.add(md_file.stem)
            
            # Second pass: find all linked notes
            for md_file in search_path.rglob("*.md"):
                if ".obsidian" in md_file.parts:
                    continue
                
                try:
                    content = md_file.read_text(encoding="utf-8")
                    links = extract_links(content)
                    linked_notes.update(links)
                except Exception:
                    continue
            
            orphaned = sorted(list(all_notes - linked_notes))
            
            return {
                "folder": folder or "root",
                "total_notes": len(all_notes),
                "linked_notes": len(linked_notes),
                "orphaned_notes": orphaned,
                "total_orphaned": len(orphaned)
            }
        except Exception as e:
            return {"error": str(e), "orphaned_notes": []}
    
    
    @mcp.tool()
    def find_broken_links(folder: Optional[str] = None) -> dict:
        """
        Find links that point to non-existent notes.
        
        Args:
            folder: Optional folder path to limit search
        
        Returns:
            Dictionary with broken links
        """
        try:
            vault_path = get_vault_path()
            
            if folder:
                search_path = vault_path / folder
            else:
                search_path = vault_path
            
            if not search_path.exists():
                return {"error": f"Folder not found: {folder}", "broken_links": []}
            
            # Collect all existing notes
            existing_notes = set()
            for md_file in vault_path.rglob("*.md"):
                if ".obsidian" in md_file.parts:
                    continue
                existing_notes.add(md_file.stem)
                # Also add with .md extension for matching
                existing_notes.add(md_file.name)
            
            broken_links = []
            
            for md_file in search_path.rglob("*.md"):
                if ".obsidian" in md_file.parts:
                    continue
                
                try:
                    content = md_file.read_text(encoding="utf-8")
                    links = extract_links(content)
                    rel_path = md_file.relative_to(vault_path)
                    
                    for link in links:
                        # Check if linked note exists
                        if link not in existing_notes:
                            broken_links.append({
                                "source_note": md_file.stem,
                                "source_path": str(rel_path),
                                "broken_link": link
                            })
                except Exception:
                    continue
            
            return {
                "folder": folder or "root",
                "broken_links": broken_links,
                "total_broken": len(broken_links)
            }
        except Exception as e:
            return {"error": str(e), "broken_links": []}
