import type { DetectionRule } from "../utils/types.js";
import { collectLiteralMatches } from "../utils/regex.js";
import type { Detector } from "./Detector.js";
import type { Detection, DetectionContext } from "../utils/types.js";
import { isRangeProtected } from "../utils/text.js";

export class PatternDetector implements Detector {
  readonly id = "pattern";
  readonly name = "Literal pattern detector";

  constructor(private readonly rules: DetectionRule[]) {}

  detect(content: string, context: DetectionContext): Detection[] {
    const detections: Detection[] = [];
    for (const rule of this.rules) {
      if (rule.match.type !== "literal") {
        continue;
      }
      const matches = collectLiteralMatches(
        rule.match.value,
        content,
        Boolean(rule.match.caseInsensitive),
      );
      for (const match of matches) {
        if (rule.skipProtectedRanges !== false && isRangeProtected(match, context.protectedRanges)) {
          continue;
        }
        detections.push({
          id: `${rule.id}:${match.start}`,
          ruleId: rule.id,
          type: rule.type,
          start: match.start,
          end: match.end,
          matchedText: match.text,
          confidence: rule.confidence,
          reason: `Literal rule ${rule.id} matched.`,
          action: rule.action,
        });
      }
    }
    return detections;
  }
}
