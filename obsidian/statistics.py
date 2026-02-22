"""
Obsidian Statistics and Analysis

Provides tools for analyzing vault statistics and note relationships.
"""

import re
from pathlib import Path
from typing import List, Optional
from collections import Counter, defaultdict
from obsidian.vault import get_vault_path
from obsidian.tags import extract_tags
from obsidian.links import extract_links


def register_statistics_tools(mcp):
    """
    Register all statistics-related MCP tools.
    
    Args:
        mcp: FastMCP instance to register tools with
    """
    
    @mcp.tool()
    def get_vault_statistics(folder: Optional[str] = None) -> dict:
        """
        Get comprehensive statistics about the vault.
        
        Args:
            folder: Optional folder path to limit statistics
        
        Returns:
            Dictionary with vault statistics
        """
        try:
            vault_path = get_vault_path()
            
            if folder:
                search_path = vault_path / folder
            else:
                search_path = vault_path
            
            if not search_path.exists():
                return {"error": f"Folder not found: {folder}"}
            
            total_notes = 0
            total_size = 0
            total_lines = 0
            all_tags = []
            all_links = []
            note_sizes = []
            folders = set()
            
            for md_file in search_path.rglob("*.md"):
                if ".obsidian" in md_file.parts:
                    continue
                
                try:
                    content = md_file.read_text(encoding="utf-8")
                    total_notes += 1
                    total_size += len(content)
                    total_lines += len(content.splitlines())
                    note_sizes.append(len(content))
                    
                    # Extract tags and links
                    tags = extract_tags(content)
                    all_tags.extend(tags)
                    
                    links = extract_links(content)
                    all_links.extend(links)
                    
                    # Track folders
                    rel_path = md_file.relative_to(vault_path)
                    if rel_path.parent != Path("."):
                        folders.add(str(rel_path.parent))
                except Exception:
                    continue
            
            # Calculate averages
            avg_size = total_size / total_notes if total_notes > 0 else 0
            avg_lines = total_lines / total_notes if total_notes > 0 else 0
            
            # Tag statistics
            tag_counts = Counter(all_tags)
            unique_tags = len(tag_counts)
            most_common_tags = [{"tag": tag, "count": count} for tag, count in tag_counts.most_common(10)]
            
            # Link statistics
            link_counts = Counter(all_links)
            unique_links = len(link_counts)
            most_linked_notes = [{"note": note, "count": count} for note, count in link_counts.most_common(10)]
            
            return {
                "folder": folder or "root",
                "total_notes": total_notes,
                "total_size_bytes": total_size,
                "total_size_kb": round(total_size / 1024, 2),
                "total_lines": total_lines,
                "average_note_size": round(avg_size, 2),
                "average_lines_per_note": round(avg_lines, 2),
                "total_folders": len(folders),
                "folders": sorted(list(folders)),
                "unique_tags": unique_tags,
                "total_tag_instances": len(all_tags),
                "most_common_tags": most_common_tags,
                "unique_links": unique_links,
                "total_link_instances": len(all_links),
                "most_linked_notes": most_linked_notes
            }
        except Exception as e:
            return {"error": str(e)}
    
    
    @mcp.tool()
    def get_note_statistics(note_name: str) -> dict:
        """
        Get detailed statistics about a specific note.
        
        Args:
            note_name: Name of the note (without .md extension) or relative path
        
        Returns:
            Dictionary with note statistics
        """
        try:
            vault_path = get_vault_path()
            note_path = vault_path / f"{note_name}.md"
            
            if not note_path.exists():
                note_path = vault_path / note_name
            
            if not note_path.exists():
                return {"error": f"Note not found: {note_name}"}
            
            content = note_path.read_text(encoding="utf-8")
            
            # Basic stats
            size = len(content)
            lines = content.splitlines()
            total_lines = len(lines)
            non_empty_lines = len([l for l in lines if l.strip()])
            
            # Extract tags and links
            tags = extract_tags(content)
            links = extract_links(content)
            
            # Count words (simple word count)
            words = content.split()
            word_count = len(words)
            
            # Count headings
            heading_patterns = [
                (r'^#{6}\s', 6),
                (r'^#{5}\s', 5),
                (r'^#{4}\s', 4),
                (r'^#{3}\s', 3),
                (r'^#{2}\s', 2),
                (r'^#{1}\s', 1)
            ]
            headings = {i: 0 for i in range(1, 7)}
            for line in lines:
                for pattern, level in heading_patterns:
                    import re
                    if re.match(pattern, line):
                        headings[level] += 1
                        break
            
            # Count code blocks
            code_blocks = content.count("```")
            code_block_count = code_blocks // 2
            
            # Count images
            image_count = len(re.findall(r'!\[.*?\]\(.*?\)', content))
            
            # Count external links
            external_links = len(re.findall(r'\[.*?\]\(https?://.*?\)', content))
            
            return {
                "note_name": note_path.stem,
                "path": str(note_path.relative_to(vault_path)),
                "size_bytes": size,
                "size_kb": round(size / 1024, 2),
                "total_lines": total_lines,
                "non_empty_lines": non_empty_lines,
                "word_count": word_count,
                "tags": tags,
                "tag_count": len(tags),
                "links": links,
                "link_count": len(links),
                "headings": headings,
                "total_headings": sum(headings.values()),
                "code_blocks": code_block_count,
                "images": image_count,
                "external_links": external_links
            }
        except Exception as e:
            return {"error": str(e)}
    
    
    @mcp.tool()
    def find_most_linked_notes(limit: int = 10, folder: Optional[str] = None) -> dict:
        """
        Find the most frequently linked notes in the vault.
        
        Args:
            limit: Maximum number of notes to return
            folder: Optional folder path to limit search
        
        Returns:
            Dictionary with most linked notes
        """
        try:
            vault_path = get_vault_path()
            
            if folder:
                search_path = vault_path / folder
            else:
                search_path = vault_path
            
            if not search_path.exists():
                return {"error": f"Folder not found: {folder}", "notes": []}
            
            link_counts = Counter()
            
            for md_file in search_path.rglob("*.md"):
                if ".obsidian" in md_file.parts:
                    continue
                
                try:
                    content = md_file.read_text(encoding="utf-8")
                    links = extract_links(content)
                    link_counts.update(links)
                except Exception:
                    continue
            
            most_linked = [
                {
                    "note": note,
                    "link_count": count
                }
                for note, count in link_counts.most_common(limit)
            ]
            
            return {
                "folder": folder or "root",
                "most_linked_notes": most_linked,
                "total_unique_notes_linked": len(link_counts)
            }
        except Exception as e:
            return {"error": str(e), "notes": []}
    
    
    @mcp.tool()
    def get_note_graph_data(note_name: Optional[str] = None, depth: int = 1) -> dict:
        """
        Get graph data showing note relationships.
        
        Args:
            note_name: Optional specific note to analyze (if None, returns all relationships)
            depth: Depth of relationship traversal (1 = direct links only)
        
        Returns:
            Dictionary with graph data (nodes and edges)
        """
        try:
            vault_path = get_vault_path()
            
            nodes = []
            edges = []
            
            if note_name:
                # Analyze specific note and its relationships
                note_path = vault_path / f"{note_name}.md"
                if not note_path.exists():
                    note_path = vault_path / note_name
                
                if not note_path.exists():
                    return {"error": f"Note not found: {note_name}"}
                
                # Add central node
                nodes.append({
                    "id": note_path.stem,
                    "label": note_path.stem,
                    "type": "central"
                })
                
                # Get direct links
                content = note_path.read_text(encoding="utf-8")
                links = extract_links(content)
                
                for link in links:
                    linked_path = vault_path / f"{link}.md"
                    if linked_path.exists():
                        nodes.append({
                            "id": link,
                            "label": link,
                            "type": "linked"
                        })
                        edges.append({
                            "source": note_path.stem,
                            "target": link,
                            "type": "outgoing"
                        })
                
                # Get backlinks
                for md_file in vault_path.rglob("*.md"):
                    if ".obsidian" in md_file.parts or md_file == note_path:
                        continue
                    
                    try:
                        file_content = md_file.read_text(encoding="utf-8")
                        file_links = extract_links(file_content)
                        
                        if note_path.stem in file_links or note_name in file_links:
                            if md_file.stem not in [n["id"] for n in nodes]:
                                nodes.append({
                                    "id": md_file.stem,
                                    "label": md_file.stem,
                                    "type": "backlink"
                                })
                            edges.append({
                                "source": md_file.stem,
                                "target": note_path.stem,
                                "type": "incoming"
                            })
                    except Exception:
                        continue
            else:
                # Analyze all notes
                note_map = {}
                
                # First pass: collect all notes
                for md_file in vault_path.rglob("*.md"):
                    if ".obsidian" in md_file.parts:
                        continue
                    note_map[md_file.stem] = md_file
                    nodes.append({
                        "id": md_file.stem,
                        "label": md_file.stem,
                        "type": "note"
                    })
                
                # Second pass: collect all links
                for md_file in vault_path.rglob("*.md"):
                    if ".obsidian" in md_file.parts:
                        continue
                    
                    try:
                        content = md_file.read_text(encoding="utf-8")
                        links = extract_links(content)
                        
                        for link in links:
                            if link in note_map:
                                edges.append({
                                    "source": md_file.stem,
                                    "target": link,
                                    "type": "link"
                                })
                    except Exception:
                        continue
            
            return {
                "note": note_name or "all",
                "nodes": nodes,
                "edges": edges,
                "total_nodes": len(nodes),
                "total_edges": len(edges)
            }
        except Exception as e:
            return {"error": str(e)}
