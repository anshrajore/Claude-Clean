import { applyEdits, modify, parseTree, type Node } from "jsonc-parser";
import type { Detection, Removal } from "../utils/types.js";
import { AppError } from "../utils/types.js";

interface JsonStringNode {
  start: number;
  end: number;
  value: string;
  path: Array<string | number>;
}

export function parseJsonOrThrow(content: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw new AppError("JSON_PARSE", "JSON is malformed and cannot be cleaned with the JSON parser.");
  }
}

export function jsonStillParseable(content: string): boolean {
  try {
    JSON.parse(content);
    return true;
  } catch {
    return false;
  }
}

export function collectJsonStringNodes(content: string): JsonStringNode[] {
  const tree = parseTree(content);
  if (!tree) {
    throw new AppError("JSON_PARSE", "JSON is malformed and cannot be inspected.");
  }
  const nodes: JsonStringNode[] = [];
  walkJson(tree, [], nodes);
  return nodes;
}

export function applyJsonRemovals(
  content: string,
  detections: Detection[],
): { text: string; removals: Removal[] } {
  parseJsonOrThrow(content);
  let next = content;
  const removals: Removal[] = [];
  const relevant = detections
    .filter((detection) => detection.action === "remove")
    .sort((a, b) => b.start - a.start);

  for (const detection of relevant) {
    const nodes = collectJsonStringNodes(next);
    const node = nodes.find(
      (candidate) => detection.matchedText && candidate.value.includes(detection.matchedText),
    );
    if (!node) {
      continue;
    }
    const remaining = node.value.split(detection.matchedText).join("").trim();
    const nextValue = remaining === "" ? undefined : remaining;
    const edits = modify(next, node.path, nextValue, {
      formattingOptions: { insertSpaces: true, tabSize: 2 },
    });
    if (edits.length === 0) {
      continue;
    }
    for (const edit of edits) {
      removals.push({
        start: edit.offset,
        end: edit.offset + edit.length,
        replacement: edit.content,
      });
    }
    next = applyEdits(next, edits);
  }

  parseJsonOrThrow(next);
  return { text: next, removals };
}

function walkJson(node: Node, path: Array<string | number>, acc: JsonStringNode[]): void {
  if (node.type === "string" && typeof node.value === "string") {
    acc.push({
      start: node.offset,
      end: node.offset + node.length,
      value: node.value,
      path,
    });
    return;
  }
  if (node.type === "object" && node.children) {
    for (const property of node.children) {
      const keyNode = property.children?.[0];
      const valueNode = property.children?.[1];
      if (!keyNode || !valueNode || typeof keyNode.value !== "string") {
        continue;
      }
      walkJson(valueNode, [...path, keyNode.value], acc);
    }
    return;
  }
  if (node.type === "array" && node.children) {
    node.children.forEach((child, index) => {
      walkJson(child, [...path, index], acc);
    });
  }
}
