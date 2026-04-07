import path from "path";
import fs from "fs";
import os from "os";
import { loadSettings } from "../settings.js";

const settings = loadSettings();

let cliVaultPath: string | undefined;

/**
 * CLI 인자로 전달된 vault 경로를 설정한다.
 * 환경 변수나 .env보다 우선한다.
 */
export function setVaultPathFromArgs(vaultPath: string): void {
  // ~ 를 홈 디렉토리로 확장
  const resolved = vaultPath.startsWith("~")
    ? path.join(os.homedir(), vaultPath.slice(1))
    : path.resolve(vaultPath);
  cliVaultPath = resolved;
}

export function getVaultPath(): string {
  // 1순위: CLI 인자
  if (cliVaultPath) {
    if (!fs.existsSync(cliVaultPath)) {
      throw new Error(`Obsidian vault path does not exist: ${cliVaultPath}`);
    }
    return cliVaultPath;
  }

  // 2순위: 환경 변수 / .env
  if (settings.obsidianVaultPath) {
    const vaultPath = settings.obsidianVaultPath;
    if (!fs.existsSync(vaultPath)) {
      throw new Error(`Obsidian vault path does not exist: ${vaultPath}`);
    }
    return vaultPath;
  }

  // 3순위: 기본 경로 탐색
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
    "Obsidian vault path not found. Pass it as an argument or set OBSIDIAN_VAULT_PATH"
  );
}
