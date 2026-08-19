import { promises as fs } from "node:fs";
import path from "node:path";
import { DetectorRegistry } from "../detector/DetectorRegistry.js";
import { applyRemovals, detectionsToRemovals } from "./applyRemovals.js";
import { applyJsonRemovals } from "../parser/json.js";
import { analyzeMarkdown } from "../parser/markdown.js";
import type { AppConfig } from "../config/loadConfig.js";
import { loadConfig } from "../config/loadConfig.js";
import { loadRules } from "../rules/loadRules.js";
import { classifyConfidence, validateTransformation } from "../validation/validate.js";
import {
  AppError,
  type CleanResult,
  type CliOptions,
  type Detection,
  type DetectionContext,
  type FileKind,
  type Range,
  type Removal,
  type ScanResult,
} from "../utils/types.js";
import { buildLineStarts, sha256 } from "../utils/text.js";
import {
  DEFAULT_MAX_FILE_BYTES,
  assertRegularFile,
  assertSafePath,
  extensionKind,
  looksBinary,
} from "../utils/fsSafe.js";

export interface Engine {
  config: AppConfig;
  registry: DetectorRegistry;
}

export async function createEngine(cwd = process.cwd()): Promise<Engine> {
  const config = await loadConfig(cwd);
  const extraDirs = config.rules.extraDirs.map((dir) => path.resolve(cwd, dir));
  const rules = await loadRules(config.rules.enabled, extraDirs);
  return { config, registry: new DetectorRegistry(rules) };
}

export async function readSourceFile(
  inputPath: string,
  cwd = process.cwd(),
  maxFileBytes = DEFAULT_MAX_FILE_BYTES,
): Promise<{ filePath: string; content: string; kind: FileKind }> {
  const filePath = assertSafePath(inputPath, cwd);
  assertRegularFile(filePath, maxFileBytes);
  const buffer = await fs.readFile(filePath);
  if (looksBinary(buffer)) {
    throw new AppError("BINARY_FILE", `Refusing to process binary file: ${filePath}`);
  }
  return { filePath, content: buffer.toString("utf8"), kind: extensionKind(filePath) };
}

export function buildContext(
  filePath: string,
  content: string,
  kind: FileKind,
  includeCode: boolean,
): DetectionContext {
  const protectedRanges: Range[] = [];
  if (kind === "markdown") {
    const structure = analyzeMarkdown(content, includeCode);
    protectedRanges.push(...structure.codeBlockRanges);
  }
  if (kind === "html" && !includeCode) {
    protectedRanges.push(...htmlProtectedRanges(content));
  }
  return {
    filePath,
    fileKind: kind,
    includeCode,
    protectedRanges,
    lineStarts: buildLineStarts(content),
  };
}

export function scanContent(
  engine: Engine,
  filePath: string,
  content: string,
  kind: FileKind,
  includeCode: boolean,
): Detection[] {
  const context = buildContext(filePath, content, kind, includeCode);
  return engine.registry.detect(content, context);
}

export async function scanFile(
  inputPath: string,
  options: Partial<CliOptions> = {},
  cwd = process.cwd(),
  engine?: Engine,
): Promise<ScanResult> {
  const active = engine ?? (await createEngine(cwd));
  const maxFileBytes = options.maxFileBytes ?? active.config.processing.maxFileBytes;
  const includeCode = options.includeCode ?? active.config.processing.includeCode;
  const { filePath, content, kind } = await readSourceFile(inputPath, cwd, maxFileBytes);
  const watermarks = scanContent(active, filePath, content, kind, includeCode);
  return {
    filePath,
    watermarks,
    alreadyClean: watermarks.filter((item) => item.action === "remove").length === 0,
  };
}

export function planClean(
  engine: Engine,
  content: string,
  filePath: string,
  kind: FileKind,
  options: Partial<CliOptions>,
): {
  detections: Detection[];
  actionable: Detection[];
  removals: Removal[];
  cleaned: string;
} {
  const includeCode = options.includeCode ?? engine.config.processing.includeCode;
  const detections = scanContent(engine, filePath, content, kind, includeCode);
  const minConfidence =
    options.confidence ?? engine.config.confidence.automaticRemoval;
  const actionable = detections.filter((detection) => {
    if (detection.action !== "remove") {
      return false;
    }
    const bucket = classifyConfidence(
      detection,
      engine.config.confidence.automaticRemoval,
      engine.config.confidence.preview,
      engine.config.confidence.report,
    );
    if (options.yes) {
      return detection.confidence >= (options.confidence ?? engine.config.confidence.preview);
    }
    if (bucket === "automatic") {
      return detection.confidence >= minConfidence || detection.confidence >= engine.config.confidence.automaticRemoval;
    }
    return false;
  });

  if (kind === "json") {
    const jsonResult = applyJsonRemovals(content, actionable);
    return {
      detections,
      actionable,
      removals: jsonResult.removals,
      cleaned: jsonResult.text,
    };
  }

  const removals = detectionsToRemovals(actionable, (detection) =>
    engine.registry.expandDetection(content, detection),
  );
  const cleaned = applyRemovals(content, removals);
  return { detections, actionable, removals, cleaned };
}

function htmlProtectedRanges(content: string): Range[] {
  const ranges: Range[] = [];
  const pattern = /<(code|pre|script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
  let match: RegExpExecArray | null = pattern.exec(content);
  while (match) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
    match = pattern.exec(content);
  }
  return ranges;
}

export function defaultOutputPath(filePath: string, suffix: string): string {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, `${parsed.name}${suffix}${parsed.ext}`);
}

export async function writeBackup(filePath: string, overwrite: boolean): Promise<string> {
  const backupPath = `${filePath}.claude-clean.bak`;
  try {
    await fs.access(backupPath);
    if (!overwrite) {
      throw new AppError(
        "BACKUP_EXISTS",
        `Backup already exists: ${backupPath}. Pass --overwrite-backup to replace it.`,
      );
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
  }
  await fs.copyFile(filePath, backupPath);
  return backupPath;
}

export async function cleanFile(
  inputPath: string,
  options: Partial<CliOptions> = {},
  cwd = process.cwd(),
  engine?: Engine,
): Promise<CleanResult> {
  const active = engine ?? (await createEngine(cwd));
  const maxFileBytes = options.maxFileBytes ?? active.config.processing.maxFileBytes;
  const { filePath, content, kind } = await readSourceFile(inputPath, cwd, maxFileBytes);
  const plan = planClean(active, content, filePath, kind, options);
  const originalHash = sha256(content);

  if (plan.actionable.length === 0) {
    return {
      filePath,
      outputPath: null,
      detections: plan.detections,
      removals: [],
      written: false,
      alreadyClean: true,
      originalHash,
      cleanedHash: originalHash,
    };
  }

  const maxDeletionRatio = options.maxDeletionRatio ?? active.config.processing.maxDeletionRatio;
  const validation = validateTransformation(
    content,
    plan.cleaned,
    kind,
    plan.removals,
    maxDeletionRatio,
  );

  if (options.dryRun) {
    return {
      filePath,
      outputPath: null,
      detections: plan.detections,
      removals: plan.removals,
      written: false,
      alreadyClean: false,
      originalHash,
      cleanedHash: validation.cleanedHash,
    };
  }

  const suffix = active.config.output.suffix;
  const outputPath = options.inPlace
    ? filePath
    : options.output
      ? assertSafePath(options.output, cwd)
      : defaultOutputPath(filePath, suffix);

  if (options.backup ?? active.config.processing.backup) {
    await writeBackup(filePath, Boolean(options.overwriteBackup));
  }

  await fs.writeFile(outputPath, plan.cleaned, "utf8");
  return {
    filePath,
    outputPath,
    detections: plan.detections,
    removals: plan.removals,
    written: true,
    alreadyClean: false,
    originalHash,
    cleanedHash: validation.cleanedHash,
  };
}

export async function diffFile(
  inputPath: string,
  options: Partial<CliOptions> = {},
  cwd = process.cwd(),
  engine?: Engine,
): Promise<{ filePath: string; detections: Detection[]; diff: string }> {
  const active = engine ?? (await createEngine(cwd));
  const maxFileBytes = options.maxFileBytes ?? active.config.processing.maxFileBytes;
  const { filePath, content, kind } = await readSourceFile(inputPath, cwd, maxFileBytes);
  const plan = planClean(active, content, filePath, kind, { ...options, yes: true, confidence: options.confidence ?? 0 });
  const lines = plan.actionable.map((detection) => `- ${detection.matchedText.replace(/\n/g, "\\n")}`);
  return {
    filePath,
    detections: plan.detections,
    diff: lines.length > 0 ? lines.join("\n") : "",
  };
}
