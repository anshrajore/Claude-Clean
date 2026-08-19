import type { Detection, DetectionContext, DetectionRule } from "../utils/types.js";
import { ZERO_WIDTH_CODEPOINTS, isRangeProtected } from "../utils/text.js";
import type { Detector } from "./Detector.js";

export class UnicodeSequenceDetector implements Detector {
  readonly id = "unicode-sequence";
  readonly name = "Unicode sequence detector";

  constructor(private readonly rules: DetectionRule[]) {}

  detect(content: string, context: DetectionContext): Detection[] {
    const detections: Detection[] = [];
    for (const rule of this.rules) {
      if (rule.match.type !== "unicode-sequence") {
        continue;
      }
      const alphabet = new Set(
        rule.match.characters.length > 0 ? rule.match.characters : ZERO_WIDTH_CODEPOINTS,
      );
      const minRun = rule.match.minRun ?? 4;
      let runStart = -1;
      let runLength = 0;
      for (let i = 0; i < content.length; i += 1) {
        const char = content[i]!;
        if (alphabet.has(char)) {
          if (runStart === -1) {
            runStart = i;
            runLength = 1;
          } else {
            runLength += 1;
          }
        } else if (runStart !== -1) {
          this.pushRun(detections, rule, context, content, runStart, runLength, minRun);
          runStart = -1;
          runLength = 0;
        }
      }
      if (runStart !== -1) {
        this.pushRun(detections, rule, context, content, runStart, runLength, minRun);
      }
    }
    return detections;
  }

  private pushRun(
    detections: Detection[],
    rule: DetectionRule,
    context: DetectionContext,
    content: string,
    start: number,
    length: number,
    minRun: number,
  ): void {
    if (length < minRun) {
      return;
    }
    const end = start + length;
    if (rule.skipProtectedRanges !== false && isRangeProtected({ start, end }, context.protectedRanges)) {
      return;
    }
    detections.push({
      id: `${rule.id}:${start}`,
      ruleId: rule.id,
      type: rule.type,
      start,
      end,
      matchedText: content.slice(start, end),
      confidence: rule.confidence,
      reason: `Unicode sequence rule ${rule.id} matched a run of ${length} characters.`,
      action: rule.action,
    });
  }
}
