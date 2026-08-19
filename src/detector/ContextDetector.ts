import type { Detection, DetectionContext } from "../utils/types.js";
import { expandRangeToFullLine, offsetToLineColumn } from "../utils/text.js";
import type { Detector } from "./Detector.js";

export class ContextDetector implements Detector {
  readonly id = "context";
  readonly name = "Context-aware confidence adjuster";

  detect(_content: string, _context: DetectionContext): Detection[] {
    return [];
  }

  refine(content: string, context: DetectionContext, detections: Detection[]): Detection[] {
    return detections.map((detection) => {
      const before = content.slice(Math.max(0, detection.start - 80), detection.start);
      const after = content.slice(detection.end, Math.min(content.length, detection.end + 80));
      let confidence = detection.confidence;
      let reason = detection.reason;

      const { line } = offsetToLineColumn(context.lineStarts, detection.start);
      const isOwnLine =
        (detection.start === 0 || content[detection.start - 1] === "\n") &&
        (detection.end === content.length ||
          content[detection.end] === "\n" ||
          content.slice(detection.start, detection.end).includes("\n"));

      const midSentence =
        /[A-Za-z0-9)]$/.test(before.trimEnd()) && /^[A-Za-z0-9(]/.test(after.trimStart());

      if (isOwnLine || line === context.lineStarts.length) {
        confidence = Math.min(1, confidence + 0.02);
        reason = `${reason} Standalone or trailing line increased confidence.`;
      } else if (midSentence) {
        confidence = Math.max(0, confidence - 0.2);
        reason = `${reason} Mid-sentence occurrence lowered confidence.`;
      }

      if (context.fileKind === "json" && detection.type === "attribution") {
        confidence = Math.min(1, confidence + 0.01);
      }

      return { ...detection, confidence: roundConfidence(confidence), reason };
    });
  }

  expandIfWholeLine(
    content: string,
    detection: Detection,
    expandToLine: boolean,
  ): { start: number; end: number } {
    if (!expandToLine) {
      return { start: detection.start, end: detection.end };
    }
    return expandRangeToFullLine(content, detection.start, detection.end);
  }
}

function roundConfidence(value: number): number {
  return Math.round(value * 1000) / 1000;
}
