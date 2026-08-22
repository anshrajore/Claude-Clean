import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PROCESSABLE_EXTENSIONS } from "./fsSafe.js";
import { AppError } from "./types.js";

export function packageRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..");
}

export async function collectFiles(
  target: string,
  recursive: boolean,
  ignorePatterns: string[] = [],
): Promise<string[]> {
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
  await walk(target, target, results, ignorePatterns);
  return results;
}

async function walk(
  root: string,
  dir: string,
  results: string[],
  ignorePatterns: string[],
): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") {
      continue;
    }
    const full = path.join(dir, entry.name);
    const relative = path.relative(root, full);
    if (isIgnored(relative, entry.name, ignorePatterns)) {
      continue;
    }
    if (entry.isSymbolicLink()) {
      continue;
    }
    if (entry.isDirectory()) {
      await walk(root, full, results, ignorePatterns);
      continue;
    }
    if (entry.isFile() && PROCESSABLE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      results.push(full);
    }
  }
}

export function isIgnored(relativePath: string, basename: string, patterns: string[]): boolean {
  const normalized = relativePath.split(path.sep).join("/");
  return patterns.some((pattern) => matchesPattern(normalized, basename, pattern));
}

function matchesPattern(relativePath: string, basename: string, pattern: string): boolean {
  const trimmed = pattern.trim();
  if (!trimmed) {
    return false;
  }
  if (!trimmed.includes("/") && !trimmed.includes("*")) {
    return basename === trimmed || relativePath.split("/").includes(trimmed);
  }
  const normalized = trimmed.replace(/^\.\//, "").replace(/\/$/, "");
  const escaped = normalized
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return (
    new RegExp(`^${escaped}$`).test(relativePath) ||
    new RegExp(`(^|/)${escaped}($|/)`).test(relativePath)
  );
}
