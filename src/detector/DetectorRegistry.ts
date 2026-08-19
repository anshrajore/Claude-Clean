import type { Detection, DetectionContext, DetectionRule } from "../utils/types.js";
import { mergeOverlappingRanges } from "../utils/text.js";
import { ContextDetector } from "./ContextDetector.js";
import type { Detector } from "./Detector.js";
import { PatternDetector } from "./PatternDetector.js";
import { RegexDetector } from "./RegexDetector.js";
import { UnicodeSequenceDetector } from "./UnicodeSequenceDetector.js";

export class DetectorRegistry {
  private readonly detectors: Detector[];
  private readonly contextDetector = new ContextDetector();
  private readonly rulesById: Map<string, DetectionRule>;

  constructor(rules: DetectionRule[]) {
    this.rulesById = new Map(rules.map((rule) => [rule.id, rule]));
    this.detectors = [
      new PatternDetector(rules),
      new RegexDetector(rules),
      new UnicodeSequenceDetector(rules),
    ];
  }

  detect(content: string, context: DetectionContext): Detection[] {
    const collected: Detection[] = [];
    for (const detector of this.detectors) {
      collected.push(...detector.detect(content, context));
    }
    const refined = this.contextDetector.refine(content, context, collected);
    return dedupeDetections(refined);
  }

  expandDetection(content: string, detection: Detection): { start: number; end: number } {
    const rule = this.rulesById.get(detection.ruleId);
    return this.contextDetector.expandIfWholeLine(content, detection, Boolean(rule?.expandToLine));
  }
}

function dedupeDetections(detections: Detection[]): Detection[] {
  const bySpan = new Map<string, Detection>();
  for (const detection of detections) {
    const key = `${detection.start}:${detection.end}:${detection.ruleId}`;
    const existing = bySpan.get(key);
    if (!existing || detection.confidence > existing.confidence) {
      bySpan.set(key, detection);
    }
  }
  const unique = [...bySpan.values()].sort((a, b) => a.start - b.start);
  const mergedRanges = mergeOverlappingRanges(
    unique.map((item) => ({ start: item.start, end: item.end })),
  );
  if (mergedRanges.length === unique.length) {
    return unique;
  }
  const kept: Detection[] = [];
  const used = new Set<string>();
  for (const detection of unique) {
    const overlapKey = unique
      .filter((other) => other.start < detection.end && other.end > detection.start)
      .sort((a, b) => b.confidence - a.confidence)[0];
    if (!overlapKey) {
      continue;
    }
    const id = overlapKey.id;
    if (used.has(id)) {
      continue;
    }
    used.add(id);
    kept.push(overlapKey);
  }
  return kept.sort((a, b) => a.start - b.start);
}
