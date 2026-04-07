import path from "path";
import fs from "fs";
import os from "os";
import { loadSettings } from "../settings.js";

const settings = loadSettings();

export function getVaultPath(): string {
  if (settings.obsidianVaultPath) {
    const vaultPath = settings.obsidianVaultPath;
    if (!fs.existsSync(vaultPath)) {
      throw new Error(`Obsidian vault path does not exist: ${vaultPath}`);
    }
    return vaultPath;
  }

  const home = os.homedir();
  const defaultLocations = [
    path.join(home, "Documents", "Obsidian"),
    path.join(home, "Obsidian"),
    path.join(home, ".obsidian"),
  ];

  for (const loc of defaultLocations) {
    if (fs.existsSync(loc) && fs.statSync(loc).isDirectory()) {
      return loc;
    }
  }

  throw new Error(
    "Obsidian vault path not found. Please set OBSIDIAN_VAULT_PATH in .env file"
  );
}
