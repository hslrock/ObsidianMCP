import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export interface Settings {
  obsidianVaultPath: string | undefined;
}

export function loadSettings(): Settings {
  return {
    obsidianVaultPath: process.env.OBSIDIAN_VAULT_PATH || undefined,
  };
}
