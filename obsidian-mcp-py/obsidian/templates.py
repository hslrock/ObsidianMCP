"""
Obsidian Templates Management

Provides tools for managing note templates.
"""

from pathlib import Path
from typing import Optional, Dict
from datetime import datetime
import re
from obsidian.vault import get_vault_path, safe_path


def get_templates_folder() -> Path:
    """
    Get the templates folder path.
    Defaults to vault/.templates/ or vault/Templates/
    
    Returns:
        Path to templates folder
    """
    vault_path = get_vault_path()
    
    # Try common template folder names
    template_folders = [
        vault_path / ".templates",
        vault_path / "Templates",
        vault_path / "templates"
    ]
    
    for folder in template_folders:
        if folder.exists():
            return folder
    
    # Create default template folder if none exists
    default_folder = vault_path / "Templates"
    default_folder.mkdir(exist_ok=True)
    return default_folder


def render_template(template_content: str, variables: Dict[str, str]) -> str:
    """
    Render a template with variables.
    
    Supports {{variable}} syntax for variable substitution.
    
    Args:
        template_content: Template content with {{variable}} placeholders
        variables: Dictionary of variable names to values
    
    Returns:
        Rendered template content
    """
    content = template_content
    
    # Replace {{variable}} with values
    for key, value in variables.items():
        pattern = r'\{\{' + re.escape(key) + r'\}\}'
        content = re.sub(pattern, str(value), content)
    
    # Replace date/time variables
    now = datetime.now()
    date_vars = {
        "date": now.strftime("%Y-%m-%d"),
        "time": now.strftime("%H:%M:%S"),
        "datetime": now.strftime("%Y-%m-%d %H:%M:%S"),
        "year": now.strftime("%Y"),
        "month": now.strftime("%m"),
        "day": now.strftime("%d"),
        "weekday": now.strftime("%A"),
        "month_name": now.strftime("%B")
    }
    
    for key, value in date_vars.items():
        pattern = r'\{\{' + re.escape(key) + r'\}\}'
        content = re.sub(pattern, value, content)
    
    return content


def register_template_tools(mcp):
    """
    Register all template-related MCP tools.
    
    Args:
        mcp: FastMCP instance to register tools with
    """
    
    @mcp.tool()
    def list_templates() -> dict:
        """
        List all available templates in the vault.
        
        Returns:
            Dictionary with list of templates
        """
        try:
            templates_folder = get_templates_folder()
            
            templates = []
            for template_file in templates_folder.glob("*.md"):
                try:
                    content = template_file.read_text(encoding="utf-8")
                    templates.append({
                        "name": template_file.stem,
                        "path": str(template_file.relative_to(get_vault_path())),
                        "size": len(content),
                        "preview": content[:200] + "..." if len(content) > 200 else content
                    })
                except Exception:
                    continue
            
            templates.sort(key=lambda x: x["name"])
            
            return {
                "templates_folder": str(templates_folder.relative_to(get_vault_path())),
                "total_templates": len(templates),
                "templates": templates
            }
        except Exception as e:
            return {"error": str(e), "templates": []}
    
    
    @mcp.tool()
    def create_note_from_template(template_name: str, note_name: str, variables: Optional[Dict[str, str]] = None, folder: Optional[str] = None) -> dict:
        """
        Create a new note from a template.
        
        Args:
            template_name: Name of the template (without .md extension)
            note_name: Name for the new note (without .md extension)
            variables: Optional dictionary of variables to substitute in template
            folder: Optional folder path to create note in
        
        Returns:
            Dictionary with creation status
        """
        try:
            vault_path = get_vault_path()
            templates_folder = get_templates_folder()
            
            template_path = templates_folder / f"{template_name}.md"
            
            if not template_path.exists():
                return {"error": f"Template not found: {template_name}"}
            
            template_content = template_path.read_text(encoding="utf-8")
            
            # Render template with variables
            vars_dict = variables or {}
            rendered_content = render_template(template_content, vars_dict)
            
            # Create note
            if folder:
                note_dir = safe_path(vault_path, folder)
                note_dir.mkdir(parents=True, exist_ok=True)
                note_path = note_dir / f"{note_name}.md"
            else:
                note_path = safe_path(vault_path, f"{note_name}.md")
            
            if note_path.exists():
                return {"error": f"Note already exists: {note_name}"}
            
            note_path.write_text(rendered_content, encoding="utf-8")
            
            return {
                "success": True,
                "template_name": template_name,
                "note_name": note_name,
                "path": str(note_path.relative_to(vault_path)),
                "size": len(rendered_content)
            }
        except Exception as e:
            return {"error": str(e)}
    
    
    @mcp.tool()
    def save_template(template_name: str, content: str) -> dict:
        """
        Save a template to the templates folder.
        
        Args:
            template_name: Name of the template (without .md extension)
            content: Template content with {{variable}} placeholders
        
        Returns:
            Dictionary with save status
        """
        try:
            templates_folder = get_templates_folder()
            template_path = templates_folder / f"{template_name}.md"
            
            template_path.write_text(content, encoding="utf-8")
            
            return {
                "success": True,
                "template_name": template_name,
                "path": str(template_path.relative_to(get_vault_path())),
                "size": len(content)
            }
        except Exception as e:
            return {"error": str(e)}
    
    
    @mcp.tool()
    def get_template(template_name: str) -> dict:
        """
        Get a template's content.
        
        Args:
            template_name: Name of the template (without .md extension)
        
        Returns:
            Dictionary with template content
        """
        try:
            templates_folder = get_templates_folder()
            template_path = templates_folder / f"{template_name}.md"
            
            if not template_path.exists():
                return {"error": f"Template not found: {template_name}"}
            
            content = template_path.read_text(encoding="utf-8")
            
            return {
                "template_name": template_name,
                "content": content,
                "size": len(content),
                "lines": len(content.splitlines())
            }
        except Exception as e:
            return {"error": str(e)}
