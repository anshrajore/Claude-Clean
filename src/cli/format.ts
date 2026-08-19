import { createColors } from "picocolors";

let pc = createColors(true);
import type { Detection } from "../utils/types.js";
import { offsetToLineColumn } from "../utils/text.js";
import { classifyConfidence } from "../validation/validate.js";
import type { AppConfig } from "../config/loadConfig.js";

export function configureColor(noColor: boolean): void {
  pc = createColors(!(noColor || Boolean(process.env.NO_COLOR)));
}

export function banner(version: string): string {
  return `${pc.bold("Claude Clean")} ${pc.dim(`v${version}`)}\n${pc.dim("────────────")}`;
}

export function formatScan(
  filePath: string,
  content: string,
  detections: Detection[],
  config: AppConfig,
  lineStarts: number[],
): string {
  const lines: string[] = [];
  lines.push(`Scanning: ${filePath}`);
  lines.push("");
  if (detections.length === 0) {
    lines.push(pc.green("✓ No watermark detected."));
    lines.push(pc.green("✓ File already clean."));
    return lines.join("\n");
  }
  lines.push("Watermarks:");
  lines.push(`  ${pc.green("✓")} ${detections.length} detected`);
  lines.push("");
  const buckets = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const detection of detections) {
    const bucket = classifyConfidence(
      detection,
      config.confidence.automaticRemoval,
      config.confidence.preview,
      config.confidence.report,
    );
    if (bucket === "automatic" || bucket === "confirm") {
      buckets.HIGH += 1;
    } else if (bucket === "preview") {
      buckets.MEDIUM += 1;
    } else {
      buckets.LOW += 1;
    }
    const loc = offsetToLineColumn(lineStarts, detection.start);
    lines.push(pc.green("✓ Watermark detected"));
    lines.push(`  Type: ${detection.type === "watermark" ? "Claude attribution" : detection.type}`);
    lines.push(`  Location: line ${loc.line}`);
    lines.push(`  Confidence: ${Math.round(detection.confidence * 100)}%`);
    lines.push(`  Rule: ${detection.ruleId}`);
    lines.push("");
    lines.push(formatContext(content, lineStarts, loc.line));
    lines.push("");
  }
  lines.push("Confidence:");
  lines.push(`  HIGH      ${buckets.HIGH}`);
  lines.push(`  MEDIUM    ${buckets.MEDIUM}`);
  lines.push(`  LOW       ${buckets.LOW}`);
  return lines.join("\n");
}

export function formatContext(content: string, lineStarts: number[], line: number): string {
  const startLine = Math.max(1, line - 3);
  const endLine = Math.min(lineStarts.length, line + 2);
  const rows: string[] = ["Context:", ""];
  for (let current = startLine; current <= endLine; current += 1) {
    const start = lineStarts[current - 1] ?? 0;
    const end = lineStarts[current] ?? content.length;
    let text = content.slice(start, end);
    if (text.endsWith("\n")) {
      text = text.slice(0, -1);
    }
    const marker = current === line ? pc.yellow(`${String(current).padStart(3, " ")} | ${text}`) : `${String(current).padStart(3, " ")} | ${text}`;
    rows.push(marker);
  }
  return rows.join("\n");
}

export function formatCleanSuccess(
  outputPath: string | null,
  alreadyClean: boolean,
  written: boolean,
): string {
  if (alreadyClean) {
    return `${pc.green("✓ No watermark detected.")}\n${pc.green("✓ File already clean.")}`;
  }
  if (!written) {
    return [
      "Removing watermark...",
      "",
      pc.green("✓ Watermark removed"),
      pc.green("✓ Content preserved"),
      pc.green("✓ Content validated"),
      pc.yellow("Dry-run: no files written"),
    ].join("\n");
  }
  const lines = [
    "Removing watermark...",
    "",
    pc.green("✓ Watermark removed"),
    pc.green("✓ Content preserved"),
    pc.green("✓ Content validated"),
    pc.green("✓ Output written"),
  ];
  if (outputPath) {
    lines.push("");
    lines.push("Clean file:");
    lines.push(outputPath);
  }
  return lines.join("\n");
}

export function formatGitSummary(inspected: number, removed: number, uncertain: number): string {
  return [
    `${inspected} files inspected`,
    `${removed} watermark artifacts detected`,
    `${removed} removed`,
    `${uncertain} uncertain matches`,
  ].join("\n");
}
