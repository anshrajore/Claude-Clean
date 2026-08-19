import { parse, type DefaultTreeAdapterMap } from "parse5";
import type { Range } from "../utils/types.js";

type Document = DefaultTreeAdapterMap["document"];
type ChildNode = DefaultTreeAdapterMap["childNode"];

export interface HtmlStructure {
  parseable: boolean;
  commentRanges: Range[];
  textRanges: Range[];
}

export function analyzeHtml(content: string): HtmlStructure {
  const commentRanges: Range[] = [];
  const textRanges: Range[] = [];
  let parseable = true;
  try {
    const document = parse(content, { sourceCodeLocationInfo: true });
    walk(document, commentRanges, textRanges);
  } catch {
    parseable = false;
  }
  return { parseable, commentRanges, textRanges };
}

export function htmlStillParseable(content: string): boolean {
  try {
    parse(content, { sourceCodeLocationInfo: true });
    return true;
  } catch {
    return false;
  }
}

function walk(node: Document | ChildNode, comments: Range[], texts: Range[]): void {
  if ("nodeName" in node && node.nodeName === "#comment") {
    const loc = "sourceCodeLocation" in node ? node.sourceCodeLocation : null;
    if (loc) {
      comments.push({ start: loc.startOffset, end: loc.endOffset });
    }
  }
  if ("nodeName" in node && node.nodeName === "#text") {
    const loc = "sourceCodeLocation" in node ? node.sourceCodeLocation : null;
    if (loc) {
      texts.push({ start: loc.startOffset, end: loc.endOffset });
    }
  }
  if ("childNodes" in node) {
    for (const child of node.childNodes) {
      walk(child, comments, texts);
    }
  }
}
