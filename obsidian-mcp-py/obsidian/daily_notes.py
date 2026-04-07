"""
Obsidian Daily Notes Management

Provides tools for managing daily notes.
"""

from pathlib import Path
from typing import Optional
from datetime import datetime, date, timedelta
from obsidian.vault import get_vault_path


def get_daily_notes_folder() -> Path:
    """
    Get the daily notes folder path.
    Defaults to vault/Daily Notes/ or vault/daily/
    
    Returns:
        Path to daily notes folder
    """
    vault_path = get_vault_path()
    
    # Try common daily notes folder names
    daily_folders = [
        vault_path / "Daily Notes",
        vault_path / "daily",
        vault_path / "Daily",
        vault_path / "Journal"
    ]
    
    for folder in daily_folders:
        if folder.exists():
            return folder
    
    # Create default daily notes folder if none exists
    default_folder = vault_path / "Daily Notes"
    default_folder.mkdir(exist_ok=True)
    return default_folder


def format_daily_note_name(note_date: date) -> str:
    """
    Format date as daily note name.
    
    Args:
        note_date: Date object
    
    Returns:
        Formatted note name (e.g., "2024-01-15")
    """
    return note_date.strftime("%Y-%m-%d")


def parse_daily_note_name(note_name: str) -> Optional[date]:
    """
    Parse daily note name to date.
    
    Args:
        note_name: Note name (e.g., "2024-01-15")
    
    Returns:
        Date object or None if invalid format
    """
    try:
        return datetime.strptime(note_name, "%Y-%m-%d").date()
    except ValueError:
        return None


def register_daily_note_tools(mcp):
    """
    Register all daily note-related MCP tools.
    
    Args:
        mcp: FastMCP instance to register tools with
    """
    
    @mcp.tool()
    def create_daily_note(note_date: Optional[str] = None, template: Optional[str] = None) -> dict:
        """
        Create a daily note for a specific date.
        
        Args:
            note_date: Date in YYYY-MM-DD format (defaults to today)
            template: Optional template name to use
        
        Returns:
            Dictionary with creation status
        """
        try:
            vault_path = get_vault_path()
            daily_folder = get_daily_notes_folder()
            
            # Parse date
            if note_date:
                try:
                    target_date = datetime.strptime(note_date, "%Y-%m-%d").date()
                except ValueError:
                    return {"error": f"Invalid date format: {note_date}. Use YYYY-MM-DD"}
            else:
                target_date = date.today()
            
            note_name = format_daily_note_name(target_date)
            note_path = daily_folder / f"{note_name}.md"
            
            if note_path.exists():
                return {
                    "success": True,
                    "message": f"Daily note already exists for {note_date or 'today'}",
                    "note_name": note_name,
                    "path": str(note_path.relative_to(vault_path))
                }
            
            # Use template if provided
            if template:
                try:
                    from obsidian.templates import get_templates_folder, render_template
                    templates_folder = get_templates_folder()
                    template_path = templates_folder / f"{template}.md"
                    
                    if template_path.exists():
                        template_content = template_path.read_text(encoding="utf-8")
                        content = render_template(template_content, {
                            "date": note_name,
                            "weekday": target_date.strftime("%A"),
                            "month_name": target_date.strftime("%B")
                        })
                    else:
                        content = f"# {target_date.strftime('%A, %B %d, %Y')}\n\n"
                except Exception:
                    content = f"# {target_date.strftime('%A, %B %d, %Y')}\n\n"
            else:
                content = f"# {target_date.strftime('%A, %B %d, %Y')}\n\n"
            
            note_path.write_text(content, encoding="utf-8")
            
            return {
                "success": True,
                "note_name": note_name,
                "date": str(target_date),
                "path": str(note_path.relative_to(vault_path)),
                "size": len(content)
            }
        except Exception as e:
            return {"error": str(e)}
    
    
    @mcp.tool()
    def get_daily_note(note_date: Optional[str] = None) -> dict:
        """
        Get a daily note for a specific date.
        
        Args:
            note_date: Date in YYYY-MM-DD format (defaults to today)
        
        Returns:
            Dictionary with note content
        """
        try:
            vault_path = get_vault_path()
            daily_folder = get_daily_notes_folder()
            
            # Parse date
            if note_date:
                try:
                    target_date = datetime.strptime(note_date, "%Y-%m-%d").date()
                except ValueError:
                    return {"error": f"Invalid date format: {note_date}. Use YYYY-MM-DD"}
            else:
                target_date = date.today()
            
            note_name = format_daily_note_name(target_date)
            note_path = daily_folder / f"{note_name}.md"
            
            if not note_path.exists():
                return {
                    "error": f"Daily note not found for {note_date or 'today'}",
                    "note_name": note_name,
                    "date": str(target_date)
                }
            
            content = note_path.read_text(encoding="utf-8")
            
            return {
                "note_name": note_name,
                "date": str(target_date),
                "content": content,
                "size": len(content),
                "lines": len(content.splitlines())
            }
        except Exception as e:
            return {"error": str(e)}
    
    
    @mcp.tool()
    def list_daily_notes(start_date: Optional[str] = None, end_date: Optional[str] = None, limit: int = 50) -> dict:
        """
        List daily notes within a date range.
        
        Args:
            start_date: Start date in YYYY-MM-DD format (defaults to 30 days ago)
            end_date: End date in YYYY-MM-DD format (defaults to today)
            limit: Maximum number of notes to return
        
        Returns:
            Dictionary with list of daily notes
        """
        try:
            vault_path = get_vault_path()
            daily_folder = get_daily_notes_folder()
            
            # Parse dates
            if end_date:
                try:
                    end = datetime.strptime(end_date, "%Y-%m-%d").date()
                except ValueError:
                    return {"error": f"Invalid end_date format: {end_date}. Use YYYY-MM-DD"}
            else:
                end = date.today()
            
            if start_date:
                try:
                    start = datetime.strptime(start_date, "%Y-%m-%d").date()
                except ValueError:
                    return {"error": f"Invalid start_date format: {start_date}. Use YYYY-MM-DD"}
            else:
                start = end - timedelta(days=30)
            
            if start > end:
                return {"error": "start_date must be before end_date"}
            
            daily_notes = []
            current_date = start
            
            while current_date <= end and len(daily_notes) < limit:
                note_name = format_daily_note_name(current_date)
                note_path = daily_folder / f"{note_name}.md"
                
                if note_path.exists():
                    try:
                        content = note_path.read_text(encoding="utf-8")
                        daily_notes.append({
                            "note_name": note_name,
                            "date": str(current_date),
                            "size": len(content),
                            "lines": len(content.splitlines()),
                            "preview": content[:200] + "..." if len(content) > 200 else content
                        })
                    except Exception:
                        pass
                
                current_date += timedelta(days=1)
            
            return {
                "start_date": str(start),
                "end_date": str(end),
                "total_found": len(daily_notes),
                "daily_notes": daily_notes
            }
        except Exception as e:
            return {"error": str(e), "daily_notes": []}
