"""
Obsidian Advanced Search

Provides advanced search capabilities for Obsidian notes.
"""

import re
from pathlib import Path
from typing import Optional, List, Dict
from datetime import datetime
from obsidian.vault import get_vault_path, safe_path


def fuzzy_match(query: str, text: str) -> bool:
    """
    Simple fuzzy matching - checks if query characters appear in order in text.
    
    Args:
        query: Search query
        text: Text to search in
        
    Returns:
        True if fuzzy match found
    """
    query_lower = query.lower()
    text_lower = text.lower()
    
    query_idx = 0
    for char in text_lower:
        if query_idx < len(query_lower) and char == query_lower[query_idx]:
            query_idx += 1
    
    return query_idx == len(query_lower)


def register_advanced_search_tools(mcp):
    """
    Register all advanced search-related MCP tools.
    
    Args:
        mcp: FastMCP instance to register tools with
    """
    
    @mcp.tool()
    def search_by_regex(pattern: str, folder: Optional[str] = None) -> dict:
        """
        Search for notes using regular expression pattern.
        
        Args:
            pattern: Regular expression pattern to search for
            folder: Optional folder path to limit search
        
        Returns:
            Dictionary with matching notes and matches
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
            
            try:
                regex = re.compile(pattern, re.IGNORECASE | re.MULTILINE)
            except re.error as e:
                return {"error": f"Invalid regex pattern: {str(e)}", "matches": []}
            
            for md_file in search_path.rglob("*.md"):
                if ".obsidian" in md_file.parts:
                    continue
                
                try:
                    content = md_file.read_text(encoding="utf-8")
                    regex_matches = regex.finditer(content)
                    
                    match_list = []
                    for match in regex_matches:
                        match_list.append({
                            "line": content[:match.start()].count('\n') + 1,
                            "match": match.group(0),
                            "start": match.start(),
                            "end": match.end()
                        })
                    
                    if match_list:
                        rel_path = md_file.relative_to(vault_path)
                        matches.append({
                            "name": md_file.stem,
                            "path": str(rel_path),
                            "matches": match_list[:10],  # Limit to first 10 matches per file
                            "total_matches": len(match_list)
                        })
                except Exception:
                    continue
            
            return {
                "pattern": pattern,
                "folder": folder or "root",
                "total_files_matched": len(matches),
                "matches": matches
            }
        except Exception as e:
            return {"error": str(e), "matches": []}
    
    
    @mcp.tool()
    def search_by_date_range(start_date: str, end_date: Optional[str] = None, folder: Optional[str] = None) -> dict:
        """
        Search for notes created or modified within a date range.
        
        Args:
            start_date: Start date in YYYY-MM-DD format
            end_date: End date in YYYY-MM-DD format (defaults to today)
            folder: Optional folder path to limit search
        
        Returns:
            Dictionary with notes in date range
        """
        try:
            vault_path = get_vault_path()
            
            if folder:
                search_path = safe_path(vault_path, folder)
            else:
                search_path = vault_path
            
            if not search_path.exists():
                return {"error": f"Folder not found: {folder}", "matches": []}
            
            try:
                start = datetime.strptime(start_date, "%Y-%m-%d")
                if end_date:
                    end = datetime.strptime(end_date, "%Y-%m-%d")
                else:
                    end = datetime.now()
            except ValueError as e:
                return {"error": f"Invalid date format: {str(e)}. Use YYYY-MM-DD", "matches": []}
            
            matches = []
            
            for md_file in search_path.rglob("*.md"):
                if ".obsidian" in md_file.parts:
                    continue
                
                try:
                    stat = md_file.stat()
                    modified_time = datetime.fromtimestamp(stat.st_mtime)
                    created_time = datetime.fromtimestamp(stat.st_ctime)
                    
                    # Check if modified or created in range
                    if start <= modified_time <= end or start <= created_time <= end:
                        rel_path = md_file.relative_to(vault_path)
                        matches.append({
                            "name": md_file.stem,
                            "path": str(rel_path),
                            "created": created_time.strftime("%Y-%m-%d %H:%M:%S"),
                            "modified": modified_time.strftime("%Y-%m-%d %H:%M:%S")
                        })
                except Exception:
                    continue
            
            matches.sort(key=lambda x: x["modified"], reverse=True)
            
            return {
                "start_date": start_date,
                "end_date": end_date or datetime.now().strftime("%Y-%m-%d"),
                "folder": folder or "root",
                "total_matches": len(matches),
                "matches": matches
            }
        except Exception as e:
            return {"error": str(e), "matches": []}
    
    
    @mcp.tool()
    def fuzzy_search_note(query: str, folder: Optional[str] = None, limit: int = 20) -> dict:
        """
        Fuzzy search for notes by name.
        
        Args:
            query: Search query (characters in order)
            folder: Optional folder path to limit search
            limit: Maximum number of results to return
        
        Returns:
            Dictionary with matching note names
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
            
            for md_file in search_path.rglob("*.md"):
                if ".obsidian" in md_file.parts:
                    continue
                
                note_name = md_file.stem
                if fuzzy_match(query, note_name):
                    rel_path = md_file.relative_to(vault_path)
                    matches.append({
                        "name": note_name,
                        "path": str(rel_path)
                    })
                    
                    if len(matches) >= limit:
                        break
            
            return {
                "query": query,
                "folder": folder or "root",
                "total_matches": len(matches),
                "matches": matches
            }
        except Exception as e:
            return {"error": str(e), "matches": []}
    
    