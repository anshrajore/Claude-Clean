import type { Detection, DetectionContext, DetectionRule } from "../utils/types.js";
import { isRangeProtected } from "../utils/text.js";
import { assertSafeRegex, collectRegexMatches } from "../utils/regex.js";
import type { Detector } from "./Detector.js";

export class RegexDetector implements Detector {
  readonly id = "regex";
  readonly name = "Regular expression detector";

  private readonly compiled: Array<{ rule: DetectionRule; regex: RegExp }>;

  constructor(rules: DetectionRule[]) {
    this.compiled = [];
    for (const rule of rules) {
      if (rule.match.type !== "regex") {
        continue;
      }
      this.compiled.push({
        rule,
        regex: assertSafeRegex(rule.match.expression, rule.match.flags),
      });
    }
  }

  detect(content: string, context: DetectionContext): Detection[] {
    const detections: Detection[] = [];
    for (const { rule, regex } of this.compiled) {
      const matches = collectRegexMatches(regex, content);
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
          reason: `Regex rule ${rule.id} matched.`,
          action: rule.action,
        });
      }
    }
    return detections;
  }
}
