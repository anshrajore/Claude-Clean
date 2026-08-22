import path from "node:path";
import type { AppConfig } from "../config/loadConfig.js";
import type { ScanResult } from "../utils/types.js";
import { offsetToLineColumn } from "../utils/text.js";

export type ReportFormat = "json" | "markdown" | "sarif";

export interface ReportInput {
  results: Array<ScanResult & { content: string; lineStarts: number[] }>;
  config: AppConfig;
  cwd: string;
}

export function renderReport(format: ReportFormat, input: ReportInput): string {
  if (format === "markdown") {
    return renderMarkdown(input);
  }
  if (format === "sarif") {
    return JSON.stringify(renderSarif(input), null, 2);
  }
  return JSON.stringify(
    input.results.map(({ content: _content, lineStarts: _lineStarts, ...result }) => result),
    null,
    2,
  );
}

function renderMarkdown(input: ReportInput): string {
  const totalDetections = input.results.reduce((sum, result) => sum + result.watermarks.length, 0);
  const totalTokensSaved = input.results.reduce(
    (sum, result) => sum + result.tokenImpact.estimatedTokensSaved,
    0,
  );
  const lines = [
    "# Claude Clean Report",
    "",
    `Files scanned: ${input.results.length}`,
    `Detections: ${totalDetections}`,
    `Estimated tokens saved: ${totalTokensSaved}`,
    "",
  ];
  for (const result of input.results) {
    lines.push(`## ${path.relative(input.cwd, result.filePath) || result.filePath}`);
    lines.push("");
    if (result.watermarks.length === 0) {
      lines.push("No watermark detected.", "");
      continue;
    }
    lines.push(
      `Estimated tokens saved: ${result.tokenImpact.estimatedTokensSaved}`,
      "",
      "| Line | Confidence | Rule | Action |",
      "| --- | ---: | --- | --- |",
    );
    for (const detection of result.watermarks) {
      const loc = offsetToLineColumn(result.lineStarts, detection.start);
      lines.push(
        `| ${loc.line} | ${Math.round(detection.confidence * 100)}% | ${detection.ruleId} | ${detection.action} |`,
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}

function renderSarif(input: ReportInput): unknown {
  return {
    version: "2.1.0",
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "Claude Clean",
            informationUri: "https://github.com/anshrajore/Claude-Clean",
            rules: uniqueRules(input),
          },
        },
        results: input.results.flatMap((result) =>
          result.watermarks.map((detection) => {
            const loc = offsetToLineColumn(result.lineStarts, detection.start);
            return {
              ruleId: detection.ruleId,
              level: detection.action === "remove" ? "warning" : "note",
              message: { text: detection.reason },
              locations: [
                {
                  physicalLocation: {
                    artifactLocation: { uri: path.relative(input.cwd, result.filePath) },
                    region: { startLine: loc.line, startColumn: loc.column },
                  },
                },
              ],
            };
          }),
        ),
      },
    ],
  };
}

function uniqueRules(
  input: ReportInput,
): Array<{ id: string; shortDescription: { text: string } }> {
  const rules = new Map<string, string>();
  for (const result of input.results) {
    for (const detection of result.watermarks) {
      rules.set(detection.ruleId, detection.reason);
    }
  }
  return [...rules].map(([id, reason]) => ({ id, shortDescription: { text: reason } }));
}
