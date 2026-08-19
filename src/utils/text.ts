import { createHash } from "node:crypto";
import type { Range } from "./types.js";

export function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

export function buildLineStarts(content: string): number[] {
  const starts = [0];
  for (let i = 0; i < content.length; i += 1) {
    if (content[i] === "\n") {
      starts.push(i + 1);
    }
  }
  return starts;
}

export function offsetToLineColumn(
  lineStarts: number[],
  offset: number,
): { line: number; column: number } {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const start = lineStarts[mid] ?? 0;
    const next = lineStarts[mid + 1] ?? Number.POSITIVE_INFINITY;
    if (offset < start) {
      high = mid - 1;
    } else if (offset >= next) {
      low = mid + 1;
    } else {
      return { line: mid + 1, column: offset - start + 1 };
    }
  }
  const lastIndex = lineStarts.length - 1;
  const lastStart = lineStarts[lastIndex] ?? 0;
  return { line: lastIndex + 1, column: Math.max(1, offset - lastStart + 1) };
}

export function getLine(content: string, lineStarts: number[], lineNumber: number): string {
  const start = lineStarts[lineNumber - 1] ?? 0;
  const end = lineStarts[lineNumber] ?? content.length;
  const raw = content.slice(start, end);
  return raw.endsWith("\n") ? raw.slice(0, -1) : raw;
}

export function rangesOverlap(a: Range, b: Range): boolean {
  return a.start < b.end && b.start < a.end;
}

export function isRangeProtected(range: Range, protectedRanges: Range[]): boolean {
  return protectedRanges.some((candidate) => rangesOverlap(range, candidate));
}

export function mergeOverlappingRanges(ranges: Range[]): Range[] {
  if (ranges.length === 0) {
    return [];
  }
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: Range[] = [];
  let current = { ...sorted[0]! };
  for (let i = 1; i < sorted.length; i += 1) {
    const next = sorted[i]!;
    if (next.start <= current.end) {
      current.end = Math.max(current.end, next.end);
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);
  return merged;
}

export function expandRangeToFullLine(content: string, start: number, end: number): Range {
  let lineStart = start;
  while (lineStart > 0 && content[lineStart - 1] !== "\n") {
    lineStart -= 1;
  }
  let lineEnd = end;
  while (lineEnd < content.length && content[lineEnd] !== "\n") {
    lineEnd += 1;
  }
  const lineText = content.slice(lineStart, lineEnd);
  const matched = content.slice(start, end);
  if (lineText.trim() === matched.trim()) {
    if (lineEnd < content.length && content[lineEnd] === "\n") {
      return { start: lineStart, end: lineEnd + 1 };
    }
    if (lineStart > 0 && content[lineStart - 1] === "\n") {
      return { start: lineStart - 1, end: lineEnd };
    }
    return { start: lineStart, end: lineEnd };
  }
  return { start, end };
}

const ZERO_WIDTH_SET = new Set(["\u200B", "\u200C", "\u200D", "\u2060", "\uFEFF", "\u180E", "\u00AD"]);

export function hasZeroWidth(text: string): boolean {
  for (const char of text) {
    if (ZERO_WIDTH_SET.has(char)) {
      return true;
    }
  }
  return false;
}

export function countZeroWidth(text: string): number {
  let count = 0;
  for (const char of text) {
    if (ZERO_WIDTH_SET.has(char)) {
      count += 1;
    }
  }
  return count;
}

export const ZERO_WIDTH_CODEPOINTS = [...ZERO_WIDTH_SET];
