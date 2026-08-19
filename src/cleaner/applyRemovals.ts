import type { Detection, Removal } from "../utils/types.js";
import { AppError } from "../utils/types.js";

export function detectionsToRemovals(
  detections: Detection[],
  expand: (detection: Detection) => { start: number; end: number },
): Removal[] {
  return detections
    .filter((detection) => detection.action === "remove")
    .map((detection) => {
      const range = expand(detection);
      return { start: range.start, end: range.end, replacement: "" };
    })
    .sort((a, b) => b.start - a.start);
}

export function applyRemovals(content: string, removals: Removal[]): string {
  let next = content;
  const ordered = [...removals].sort((a, b) => b.start - a.start);
  for (const removal of ordered) {
    if (removal.start < 0 || removal.end > next.length || removal.start > removal.end) {
      throw new AppError("REMOVAL_RANGE", "A removal range is out of bounds.");
    }
    next = next.slice(0, removal.start) + removal.replacement + next.slice(removal.end);
  }
  return next;
}

export function preservedContent(original: string, cleaned: string, removals: Removal[]): boolean {
  const expected = applyRemovals(original, removals);
  return expected === cleaned;
}
