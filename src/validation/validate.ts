import type { Detection, FileKind, Removal } from "../utils/types.js";
import { AppError } from "../utils/types.js";
import { htmlStillParseable } from "../parser/html.js";
import { jsonStillParseable } from "../parser/json.js";
import { markdownStillParseable } from "../parser/markdown.js";
import { sha256 } from "../utils/text.js";

export interface ValidationResult {
  originalHash: string;
  cleanedHash: string;
  remainingRatio: number;
  parseable: boolean;
  encodingOk: boolean;
}

export function validateTransformation(
  original: string,
  cleaned: string,
  fileKind: FileKind,
  _removals: Removal[],
  maxDeletionRatio: number,
): ValidationResult {
  if (cleaned.includes("\uFFFD") && !original.includes("\uFFFD")) {
    throw new AppError("ENCODING", "Cleaning would introduce replacement characters.");
  }
  const remainingRatio = original.length === 0 ? 1 : cleaned.length / original.length;
  if (1 - remainingRatio > maxDeletionRatio) {
    const remainingPercent = Math.round(remainingRatio * 100);
    throw new AppError(
      "UNSAFE_TRANSFORM",
      `Unsafe transformation detected.\n\nOnly ${remainingPercent}% of the original content would remain.\n\nNo changes were written.`,
    );
  }

  let parseable = true;
  if (fileKind === "markdown") {
    parseable = markdownStillParseable(cleaned);
  } else if (fileKind === "html") {
    parseable = htmlStillParseable(cleaned);
  } else if (fileKind === "json") {
    parseable = jsonStillParseable(cleaned);
  }
  if (!parseable) {
    throw new AppError("PARSE_INVALID", "Cleaned output failed structure validation.");
  }

  return {
    originalHash: sha256(original),
    cleanedHash: sha256(cleaned),
    remainingRatio,
    parseable,
    encodingOk: true,
  };
}

export function classifyConfidence(
  detection: Detection,
  automaticRemoval: number,
  preview: number,
  report: number,
): "automatic" | "confirm" | "preview" | "report" {
  if (detection.confidence >= automaticRemoval) {
    return "automatic";
  }
  if (detection.confidence >= preview) {
    return "confirm";
  }
  if (detection.confidence >= report) {
    return "preview";
  }
  return "report";
}
