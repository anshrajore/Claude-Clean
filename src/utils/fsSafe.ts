import { lstatSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { AppError } from "./types.js";

const DEFAULT_MAX_FILE_BYTES = 10 * 1024 * 1024;
const BINARY_SAMPLE_BYTES = 8192;

export function assertSafePath(inputPath: string, cwd = process.cwd()): string {
  if (inputPath.includes("\0")) {
    throw new AppError("PATH_INVALID", "Path contains a null byte.");
  }
  const resolved = path.resolve(cwd, inputPath);
  const isRelative = !path.isAbsolute(inputPath);
  if (isRelative && inputPath.split(/[\\/]/).includes("..")) {
    let cwdReal = cwd;
    try {
      cwdReal = realpathSync(cwd);
    } catch {
      cwdReal = path.resolve(cwd);
    }
    const relative = path.relative(cwdReal, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new AppError(
        "PATH_TRAVERSAL",
        "Refusing to access a path outside the current working directory.",
      );
    }
  }
  return resolved;
}

export function assertRegularFile(filePath: string, maxFileBytes = DEFAULT_MAX_FILE_BYTES): void {
  let stats;
  try {
    stats = lstatSync(filePath);
  } catch {
    throw new AppError("PATH_NOT_FOUND", `File not found: ${filePath}`);
  }
  if (stats.isSymbolicLink()) {
    throw new AppError("SYMLINK_REFUSED", "Refusing to follow a symlink.");
  }
  if (!stats.isFile()) {
    throw new AppError("NOT_A_FILE", `Not a regular file: ${filePath}`);
  }
  if (stats.size > maxFileBytes) {
    throw new AppError(
      "FILE_TOO_LARGE",
      `File exceeds the ${maxFileBytes} byte limit: ${filePath}`,
    );
  }
  statSync(filePath);
}

export function looksBinary(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, BINARY_SAMPLE_BYTES));
  if (sample.includes(0)) {
    return true;
  }
  let suspicious = 0;
  for (const byte of sample) {
    if (byte < 7 || (byte > 13 && byte < 32 && byte !== 27)) {
      suspicious += 1;
    }
  }
  return suspicious / Math.max(sample.length, 1) > 0.3;
}

export function extensionKind(filePath: string): "markdown" | "html" | "json" | "text" | "unknown" {
  const ext = path.extname(filePath).toLowerCase();
  if ([".md", ".markdown", ".mdown", ".mdx"].includes(ext)) {
    return "markdown";
  }
  if ([".html", ".htm", ".xhtml"].includes(ext)) {
    return "html";
  }
  if (ext === ".json") {
    return "json";
  }
  if ([".txt", ".yml", ".yaml", ".xml", ".csv"].includes(ext)) {
    return "text";
  }
  return "unknown";
}

export const PROCESSABLE_EXTENSIONS = new Set([
  ".md",
  ".markdown",
  ".mdown",
  ".mdx",
  ".html",
  ".htm",
  ".xhtml",
  ".json",
  ".txt",
  ".yml",
  ".yaml",
  ".xml",
  ".csv",
]);

export { DEFAULT_MAX_FILE_BYTES };
