import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PROCESSABLE_EXTENSIONS } from "./fsSafe.js";
import { AppError } from "./types.js";

export function packageRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..");
}

export async function collectFiles(target: string, recursive: boolean): Promise<string[]> {
  const stats = await fs.lstat(target);
  if (stats.isSymbolicLink()) {
    return [];
  }
  if (stats.isFile()) {
    return [target];
  }
  if (!stats.isDirectory()) {
    return [];
  }
  if (!recursive) {
    throw new AppError("NOT_RECURSIVE", "Directory provided without --recursive.");
  }
  const results: string[] = [];
  await walk(target, results);
  return results;
}

async function walk(dir: string, results: string[]): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      continue;
    }
    if (entry.isDirectory()) {
      await walk(full, results);
      continue;
    }
    if (entry.isFile() && PROCESSABLE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      results.push(full);
    }
  }
}
