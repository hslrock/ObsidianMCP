"""
Obsidian Folders Management

Provides tools for managing folders in the vault.
"""

from pathlib import Path
from typing import Optional, List
from obsidian.vault import get_vault_path, safe_path


def register_folder_tools(mcp):
    """
    Register all folder-related MCP tools.
    
    Args:
        mcp: FastMCP instance to register tools with
    """
    
    @mcp.tool()
    def create_folder(folder_path: str) -> dict:
        """
        Create a new folder in the vault.
        
        Args:
            folder_path: Path to the folder (e.g., "Projects/Tasks")
        
        Returns:
            Dictionary with creation status
        """
        try:
            vault_path = get_vault_path()
            new_folder = safe_path(vault_path, folder_path)
            
            if new_folder.exists():
                return {
                    "success": True,
                    "message": f"Folder already exists: {folder_path}",
                    "folder_path": folder_path
                }
            
            new_folder.mkdir(parents=True, exist_ok=True)
            
            return {
                "success": True,
                "folder_path": folder_path,
                "full_path": str(new_folder)
            }
        except Exception as e:
            return {"error": str(e)}
    
    
    @mcp.tool()
    def move_note(note_name: str, new_folder: str) -> dict:
        """
        Move a note to a different folder.
        
        Args:
            note_name: Name of the note (without .md extension) or current relative path
            new_folder: Destination folder path (e.g., "Projects/Tasks")
        
        Returns:
            Dictionary with move status
        """
        try:
            vault_path = get_vault_path()
            
            # Find source note
            note_path = safe_path(vault_path, f"{note_name}.md")
            if not note_path.exists():
                note_path = safe_path(vault_path, note_name)
            
            if not note_path.exists():
                return {"error": f"Note not found: {note_name}"}
            
            # Create destination folder if needed
            dest_folder = safe_path(vault_path, new_folder)
            dest_folder.mkdir(parents=True, exist_ok=True)
            
            # Move note
            dest_path = dest_folder / note_path.name
            if dest_path.exists():
                return {"error": f"Note already exists in destination: {new_folder}/{note_path.name}"}
            
            note_path.rename(dest_path)
            
            return {
                "success": True,
                "note_name": note_path.stem,
                "old_path": str(note_path.relative_to(vault_path)),
                "new_path": str(dest_path.relative_to(vault_path)),
                "new_folder": new_folder
            }
        except Exception as e:
            return {"error": str(e)}
    
    
    @mcp.tool()
    def list_folders(folder: Optional[str] = None) -> dict:
        """
        List all folders in the vault.
        
        Args:
            folder: Optional parent folder to list subfolders from
        
        Returns:
            Dictionary with list of folders
        """
        try:
            vault_path = get_vault_path()
            
            if folder:
                search_path = safe_path(vault_path, folder)
            else:
                search_path = vault_path
            
            if not search_path.exists():
                return {"error": f"Folder not found: {folder}", "folders": []}
            
            folders = set()
            
            # Find all directories
            for item in search_path.rglob("*"):
                if item.is_dir() and ".obsidian" not in item.parts:
                    rel_path = item.relative_to(vault_path)
                    folders.add(str(rel_path))
            
            # Also include the root
            if not folder:
                folders.add(".")
            
            folders_list = sorted(list(folders))
            
            return {
                "parent_folder": folder or "root",
                "total_folders": len(folders_list),
                "folders": folders_list
            }
        except Exception as e:
            return {"error": str(e), "folders": []}
    
    
    @mcp.tool()
    def get_folder_statistics(folder: str) -> dict:
        """
        Get statistics about a specific folder.
        
        Args:
            folder: Folder path (e.g., "Projects")
        
        Returns:
            Dictionary with folder statistics
        """
        try:
            vault_path = get_vault_path()
            folder_path = safe_path(vault_path, folder)
            
            if not folder_path.exists():
                return {"error": f"Folder not found: {folder}"}
            
            if not folder_path.is_dir():
                return {"error": f"Path is not a folder: {folder}"}
            
            total_notes = 0
            total_size = 0
            total_lines = 0
            subfolders = []
            note_list = []
            
            for item in folder_path.iterdir():
                if item.is_dir():
                    if ".obsidian" not in item.parts:
                        subfolders.append(item.name)
                elif item.suffix == ".md":
                    try:
                        content = item.read_text(encoding="utf-8")
                        total_notes += 1
                        total_size += len(content)
                        total_lines += len(content.splitlines())
                        note_list.append({
                            "name": item.stem,
                            "size": len(content),
                            "lines": len(content.splitlines())
                        })
                    except Exception:
                        continue
            
            # Calculate averages
            avg_size = total_size / total_notes if total_notes > 0 else 0
            avg_lines = total_lines / total_notes if total_notes > 0 else 0
            
            return {
                "folder": folder,
                "total_notes": total_notes,
                "total_subfolders": len(subfolders),
                "subfolders": sorted(subfolders),
                "total_size_bytes": total_size,
                "total_size_kb": round(total_size / 1024, 2),
                "total_lines": total_lines,
                "average_note_size": round(avg_size, 2),
                "average_lines_per_note": round(avg_lines, 2),
                "notes": sorted(note_list, key=lambda x: x["name"])
            }
        except Exception as e:
            return {"error": str(e)}
    
    
    @mcp.tool()
    def delete_folder(folder_path: str, force: bool = False) -> dict:
        """
        Delete a folder from the vault.
        
        Args:
            folder_path: Path to the folder to delete
            force: If True, delete folder even if it contains notes
        
        Returns:
            Dictionary with deletion status
        """
        try:
            vault_path = get_vault_path()
            folder = safe_path(vault_path, folder_path)
            
            if not folder.exists():
                return {"error": f"Folder not found: {folder_path}"}
            
            if not folder.is_dir():
                return {"error": f"Path is not a folder: {folder_path}"}
            
            # Count notes in folder
            note_count = len(list(folder.rglob("*.md")))
            
            if note_count > 0 and not force:
                return {
                    "error": f"Folder contains {note_count} note(s). Use force=True to delete anyway.",
                    "note_count": note_count
                }
            
            # Delete folder
            import shutil
            shutil.rmtree(folder)
            
            return {
                "success": True,
                "folder_path": folder_path,
                "notes_deleted": note_count
            }
        except Exception as e:
            return {"error": str(e)}
