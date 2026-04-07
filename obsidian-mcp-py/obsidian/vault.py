"""
Obsidian Vault Management

Handles vault path resolution and validation.
"""

from pathlib import Path
from settings import load_settings

settings = load_settings()


def get_vault_path() -> Path:
    """
    Get the Obsidian vault path from settings or default location.
    
    Returns:
        Path object pointing to the Obsidian vault
        
    Raises:
        ValueError: If vault path cannot be determined or doesn't exist
    """
    if settings.obsidian_vault_path:
        vault_path = Path(settings.obsidian_vault_path)
    else:
        # Default Obsidian vault locations
        home = Path.home()
        default_locations = [
            home / "Documents" / "Obsidian",
            home / "Obsidian",
            home / ".obsidian",
        ]
        vault_path = None
        for loc in default_locations:
            if loc.exists() and loc.is_dir():
                vault_path = loc
                break
        
        if vault_path is None:
            raise ValueError(
                "Obsidian vault path not found. Please set OBSIDIAN_VAULT_PATH in .env file"
            )
    
    if not vault_path.exists():
        raise ValueError(f"Obsidian vault path does not exist: {vault_path}")

    return vault_path


def safe_path(vault_path: Path, *segments: str) -> Path:
    """
    Safely join path segments under the vault, preventing path traversal attacks.

    Raises:
        ValueError: If the resolved path escapes the vault directory
    """
    result = (vault_path / Path(*segments)).resolve()
    vault_resolved = vault_path.resolve()
    if not (result == vault_resolved or str(result).startswith(str(vault_resolved) + "/")):
        raise ValueError("Access denied: path is outside the vault")
    return result
