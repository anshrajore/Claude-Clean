export type DetectionType = "watermark" | "attribution" | "branding";

export type FileKind = "markdown" | "html" | "json" | "text" | "unknown";

export interface Range {
  start: number;
  end: number;
}

export interface DetectionContext {
  filePath: string;
  fileKind: FileKind;
  includeCode: boolean;
  protectedRanges: Range[];
  lineStarts: number[];
}

export interface Detection {
  id: string;
  ruleId: string;
  type: DetectionType;
  start: number;
  end: number;
  matchedText: string;
  confidence: number;
  reason: string;
  action: "remove" | "report" | "inspect";
}

export interface Removal {
  start: number;
  end: number;
  replacement: string;
}

export interface RuleMatchLiteral {
  type: "literal";
  value: string;
  caseInsensitive?: boolean;
}

export interface RuleMatchRegex {
  type: "regex";
  expression: string;
  flags?: string;
}

export interface RuleMatchUnicodeSequence {
  type: "unicode-sequence";
  characters: string[];
  minRun?: number;
}

export type RuleMatch = RuleMatchLiteral | RuleMatchRegex | RuleMatchUnicodeSequence;

export interface DetectionRule {
  id: string;
  provider: string;
  type: DetectionType;
  match: RuleMatch;
  confidence: number;
  action: "remove" | "report" | "inspect";
  expandToLine?: boolean;
  skipProtectedRanges?: boolean;
}

export interface ScanResult {
  filePath: string;
  watermarks: Detection[];
  alreadyClean: boolean;
}

export interface CleanResult {
  filePath: string;
  outputPath: string | null;
  detections: Detection[];
  removals: Removal[];
  written: boolean;
  alreadyClean: boolean;
  originalHash: string;
  cleanedHash: string | null;
}

export interface CliOptions {
  dryRun: boolean;
  backup: boolean;
  overwriteBackup: boolean;
  output: string | undefined;
  recursive: boolean;
  verbose: boolean;
  json: boolean;
  noColor: boolean;
  includeCode: boolean;
  inPlace: boolean;
  confidence: number | undefined;
  yes: boolean;
  maxFileBytes: number;
  maxDeletionRatio: number;
}

export class AppError extends Error {
  readonly code: string;
  readonly exitCode: number;

  constructor(code: string, message: string, exitCode = 2) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.exitCode = exitCode;
  }
}
