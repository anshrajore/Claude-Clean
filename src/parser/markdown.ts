import { fromMarkdown } from "mdast-util-from-markdown";
import { visit } from "unist-util-visit";
import type { Range } from "../utils/types.js";

export interface MarkdownStructure {
  codeBlockRanges: Range[];
  frontmatterRange: Range | null;
  parseable: boolean;
}

export function analyzeMarkdown(content: string, includeCode: boolean): MarkdownStructure {
  const frontmatterRange = detectFrontmatter(content);
  let parseable = true;
  const codeBlockRanges: Range[] = [];
  try {
    const tree = fromMarkdown(content);
    visit(tree, (node) => {
      if (node.type !== "code" && node.type !== "inlineCode") {
        return;
      }
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (typeof start === "number" && typeof end === "number") {
        codeBlockRanges.push({ start, end });
      }
    });
  } catch {
    parseable = false;
    codeBlockRanges.push(...fallbackFenceRanges(content));
  }
  return {
    parseable,
    frontmatterRange,
    codeBlockRanges: includeCode ? [] : codeBlockRanges,
  };
}

export function markdownStillParseable(content: string): boolean {
  try {
    fromMarkdown(content);
    return true;
  } catch {
    return false;
  }
}

function detectFrontmatter(content: string): Range | null {
  if (!content.startsWith("---")) {
    return null;
  }
  const end = content.indexOf("\n---", 3);
  if (end === -1) {
    return null;
  }
  const close = end + "\n---".length;
  return { start: 0, end: Math.min(content.length, close) };
}

function fallbackFenceRanges(content: string): Range[] {
  const ranges: Range[] = [];
  const fence = /^( {0,3})(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n {0,3}\2[^\S\n]*$/gm;
  let match: RegExpExecArray | null = fence.exec(content);
  while (match) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
    match = fence.exec(content);
  }
  return ranges;
}
