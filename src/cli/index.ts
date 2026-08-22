#!/usr/bin/env node
import { Command } from "commander";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { inspectContent } from "../inspect/inspectContent.js";
import {
  cleanFile,
  createEngine,
  diffFile,
  planClean,
  readSourceFile,
  scanFile,
} from "../cleaner/engine.js";
import { collectFiles, packageRoot } from "../utils/paths.js";
import { gitChangedFiles } from "../git/changedFiles.js";
import { AppError, type CliOptions, type Detection } from "../utils/types.js";
import { buildLineStarts } from "../utils/text.js";
import {
  banner,
  configureColor,
  formatCleanSuccess,
  formatGitSummary,
  formatScan,
  formatTokenImpact,
} from "./format.js";
import { PROCESSABLE_EXTENSIONS } from "../utils/fsSafe.js";
import { renderReport } from "../report/report.js";

function packageVersion(): string {
  const raw = readFileSync(path.join(packageRoot(), "package.json"), "utf8");
  return (JSON.parse(raw) as { version: string }).version;
}

function commandOptions(command: Command): Partial<CliOptions> {
  const fromCommand = command.opts() as Record<string, unknown>;
  const fromGlobals =
    typeof command.optsWithGlobals === "function"
      ? (command.optsWithGlobals() as Record<string, unknown>)
      : {};
  return collectOptions({ ...fromGlobals, ...fromCommand });
}

function addShared(command: Command): Command {
  return command
    .option("--dry-run", "Preview transformations without writing files")
    .option("--backup", "Write a .claude-clean.bak copy of the original")
    .option("--overwrite-backup", "Replace an existing backup file")
    .option("--output <file>", "Write cleaned content to this path")
    .option("--recursive", "Process directories recursively")
    .option("--verbose", "Print additional diagnostics")
    .option("--json", "Emit machine-readable JSON")
    .option("--no-color", "Disable ANSI colors")
    .option("--include-code", "Allow detections inside fenced code blocks")
    .option("--in-place", "Overwrite the original file")
    .option("--confidence <n>", "Minimum confidence required to remove")
    .option("--yes", "Remove preview-threshold matches without confirmation")
    .option("--profile <name>", "Scan profile: strict, balanced, aggressive")
    .option(
      "--ignore <pattern>",
      "Ignore a path or glob during recursive scans",
      collectRepeated,
      [],
    );
}

function collectOptions(opts: Record<string, unknown>): Partial<CliOptions> {
  const profile = typeof opts.profile === "string" ? opts.profile : undefined;
  return {
    dryRun: Boolean(opts.dryRun),
    backup: Boolean(opts.backup),
    overwriteBackup: Boolean(opts.overwriteBackup),
    output: typeof opts.output === "string" ? opts.output : undefined,
    recursive: Boolean(opts.recursive),
    verbose: Boolean(opts.verbose),
    json: Boolean(opts.json),
    noColor: opts.color === false,
    includeCode: Boolean(opts.includeCode),
    inPlace: Boolean(opts.inPlace),
    confidence: typeof opts.confidence === "string" ? Number(opts.confidence) : undefined,
    yes: Boolean(opts.yes),
    profile:
      profile === "strict" || profile === "balanced" || profile === "aggressive"
        ? profile
        : undefined,
    ignore: Array.isArray(opts.ignore)
      ? opts.ignore.filter((item): item is string => typeof item === "string")
      : [],
    reportFormat:
      opts.reportFormat === "json" ||
      opts.reportFormat === "markdown" ||
      opts.reportFormat === "sarif"
        ? opts.reportFormat
        : undefined,
  };
}

function collectRepeated(value: string, previous: string[]): string[] {
  return [...previous, value];
}

async function resolveTargets(
  target: string | undefined,
  recursive: boolean,
  engine: Awaited<ReturnType<typeof createEngine>>,
  options: Partial<CliOptions> = {},
): Promise<string[]> {
  if (!target) {
    throw new AppError("USAGE", "A file or directory path is required.");
  }
  return collectFiles(path.resolve(target), recursive, [
    ...engine.config.ignore,
    ...(options.ignore ?? []),
  ]);
}

function printOrJson(jsonMode: boolean, payload: unknown, text: string): void {
  if (jsonMode) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${text}\n`);
}

function printError(error: unknown, jsonMode: boolean, verbose: boolean): never {
  if (error instanceof AppError) {
    if (jsonMode) {
      process.stdout.write(`${JSON.stringify({ error: error.code, message: error.message })}\n`);
    } else {
      process.stderr.write(`ERROR\n\n${error.message}\n`);
      if (verbose) {
        process.stderr.write(`\n${error.stack ?? ""}\n`);
      }
    }
    process.exit(error.exitCode);
  }
  const message = error instanceof Error ? error.message : String(error);
  if (jsonMode) {
    process.stdout.write(`${JSON.stringify({ error: "UNEXPECTED", message })}\n`);
  } else {
    process.stderr.write(`ERROR\n\n${message}\n`);
  }
  process.exit(2);
}

async function runScan(target: string | undefined, options: Partial<CliOptions>): Promise<void> {
  const engine = await createEngine();
  const files = await resolveTargets(target, Boolean(options.recursive), engine, options);
  const version = packageVersion();
  if (!options.json) {
    process.stdout.write(`${banner(version)}\n\n`);
  }
  const all: Array<{ filePath: string; watermarks: Detection[]; alreadyClean: boolean }> = [];
  for (const file of files) {
    const result = await scanFile(file, options, process.cwd(), engine);
    all.push(result);
    if (!options.json) {
      const source = await readSourceFile(
        file,
        process.cwd(),
        engine.config.processing.maxFileBytes,
      );
      process.stdout.write(
        `${formatScan(result.filePath, source.content, result.watermarks, engine.config, buildLineStarts(source.content))}\n`,
      );
      process.stdout.write(`${formatTokenImpact(result.tokenImpact)}\n`);
    }
  }
  if (options.json) {
    printOrJson(true, all, "");
  }
}

async function runClean(target: string | undefined, options: Partial<CliOptions>): Promise<void> {
  const engine = await createEngine();
  const files = await resolveTargets(target, Boolean(options.recursive), engine, options);
  const version = packageVersion();
  if (!options.json) {
    process.stdout.write(`${banner(version)}\n\n`);
  }
  const results = [];
  for (const file of files) {
    const scanned = await scanFile(file, options, process.cwd(), engine);
    if (!options.json) {
      const source = await readSourceFile(
        file,
        process.cwd(),
        engine.config.processing.maxFileBytes,
      );
      process.stdout.write(
        `${formatScan(scanned.filePath, source.content, scanned.watermarks, engine.config, buildLineStarts(source.content))}\n\n`,
      );
    }
    const cleaned = await cleanFile(file, options, process.cwd(), engine);
    results.push(cleaned);
    if (!options.json) {
      process.stdout.write(
        `${formatCleanSuccess(cleaned.outputPath, cleaned.alreadyClean, cleaned.written, cleaned.tokenImpact)}\n`,
      );
    }
  }
  if (options.json) {
    printOrJson(true, results, "");
  }
}

async function runDiff(target: string | undefined, options: Partial<CliOptions>): Promise<void> {
  const engine = await createEngine();
  const files = await resolveTargets(target, Boolean(options.recursive), engine, options);
  const payload = [];
  for (const file of files) {
    const result = await diffFile(file, options, process.cwd(), engine);
    payload.push(result);
    if (!options.json) {
      process.stdout.write(`${result.diff || "No removable watermarks."}\n`);
    }
  }
  if (options.json) {
    printOrJson(true, payload, "");
  }
}

async function runInspect(target: string | undefined, options: Partial<CliOptions>): Promise<void> {
  const engine = await createEngine();
  const files = await resolveTargets(target, Boolean(options.recursive), engine, options);
  const payload = [];
  for (const file of files) {
    const scan = await scanFile(file, options, process.cwd(), engine);
    const source = await readSourceFile(file, process.cwd(), engine.config.processing.maxFileBytes);
    const findings = inspectContent(source.content, scan.watermarks);
    payload.push({ filePath: scan.filePath, findings, watermarks: scan.watermarks });
    if (!options.json) {
      process.stdout.write(`Inspect ${scan.filePath}\n`);
      if (findings.length === 0) {
        process.stdout.write("No invisible artifacts found.\n");
      } else {
        for (const finding of findings.slice(0, 200)) {
          process.stdout.write(
            `- ${finding.kind} ${finding.detail} @ ${finding.start}-${finding.end}${finding.autoRemovable ? " (confirmed signature)" : " (report only)"}\n`,
          );
        }
      }
    }
  }
  if (options.json) {
    printOrJson(true, payload, "");
  }
}

async function runGit(options: Partial<CliOptions> & { staged?: boolean }): Promise<void> {
  const engine = await createEngine();
  const changed = await gitChangedFiles(Boolean(options.staged));
  const files = changed.filter((file) =>
    PROCESSABLE_EXTENSIONS.has(path.extname(file).toLowerCase()),
  );
  let removed = 0;
  let uncertain = 0;
  for (const file of files) {
    try {
      const source = await readSourceFile(
        file,
        process.cwd(),
        engine.config.processing.maxFileBytes,
      );
      const plan = planClean(engine, source.content, source.filePath, source.kind, options);
      removed += plan.actionable.length;
      uncertain += plan.detections.filter(
        (item) => item.action !== "remove" || item.confidence < engine.config.confidence.preview,
      ).length;
      if (plan.actionable.length > 0 && !options.dryRun) {
        await cleanFile(file, { ...options, inPlace: true }, process.cwd(), engine);
      }
    } catch (error) {
      if (options.verbose) {
        process.stderr.write(
          `${file}: ${error instanceof Error ? error.message : String(error)}\n`,
        );
      }
    }
  }
  const text = formatGitSummary(files.length, removed, uncertain);
  printOrJson(
    Boolean(options.json),
    { inspected: files.length, detected: removed, removed, uncertain },
    text,
  );
}

async function runCi(target: string | undefined, options: Partial<CliOptions>): Promise<void> {
  const engine = await createEngine();
  const files = target
    ? await resolveTargets(target, true, engine, options)
    : await collectFiles(process.cwd(), true, [...engine.config.ignore, ...(options.ignore ?? [])]);
  let detected = 0;
  const payload: Array<{ filePath: string; watermarks: Detection[] }> = [];
  try {
    for (const file of files) {
      const result = await scanFile(file, options, process.cwd(), engine);
      payload.push({ filePath: result.filePath, watermarks: result.watermarks });
      detected += result.watermarks.filter((item) => item.action === "remove").length;
    }
  } catch (error) {
    printError(error, Boolean(options.json), Boolean(options.verbose));
  }
  printOrJson(
    Boolean(options.json),
    { clean: detected === 0, detected },
    detected === 0 ? "clean" : `${detected} watermark(s) detected`,
  );
  process.exit(detected === 0 ? 0 : 1);
}

async function runReport(target: string | undefined, options: Partial<CliOptions>): Promise<void> {
  const engine = await createEngine();
  const files = target
    ? await resolveTargets(target, true, engine, { ...options, recursive: true })
    : await collectFiles(process.cwd(), true, [...engine.config.ignore, ...(options.ignore ?? [])]);
  const results = [];
  for (const file of files) {
    const result = await scanFile(file, options, process.cwd(), engine);
    const source = await readSourceFile(file, process.cwd(), engine.config.processing.maxFileBytes);
    results.push({
      ...result,
      content: source.content,
      lineStarts: buildLineStarts(source.content),
    });
  }
  const rendered = renderReport(options.reportFormat ?? "markdown", {
    results,
    config: engine.config,
    cwd: process.cwd(),
  });
  if (options.output) {
    const outputPath = path.resolve(options.output);
    await writeFile(outputPath, rendered, "utf8");
    if (!options.json) {
      process.stdout.write(`Report written: ${outputPath}\n`);
    }
    return;
  }
  process.stdout.write(`${rendered}\n`);
}

async function main(): Promise<void> {
  const version = packageVersion();
  const program = new Command();
  program
    .name("claude-clean")
    .description(
      "Detect and remove embedded Claude/AI watermark or attribution content from local files.",
    )
    .version(version, "--version", "Show version")
    .helpOption("--help", "Show help");

  addShared(program);

  const cleanCmd = addShared(
    program.command("clean [path]", { isDefault: true }).description("Remove confirmed watermarks"),
  );
  cleanCmd.action(async (inputPath: string | undefined) => {
    const options = commandOptions(cleanCmd);
    configureColor(Boolean(options.noColor));
    if (!inputPath) {
      program.outputHelp();
      return;
    }
    await runClean(inputPath, options);
  });

  const scanCmd = addShared(
    program.command("scan [path]").description("Detect watermarks without writing"),
  );
  scanCmd.action(async (inputPath: string | undefined) => {
    const options = commandOptions(scanCmd);
    configureColor(Boolean(options.noColor));
    await runScan(inputPath, options);
  });

  const diffCmd = addShared(
    program.command("diff [path]").description("Show watermark removals as a diff"),
  );
  diffCmd.action(async (inputPath: string | undefined) => {
    const options = commandOptions(diffCmd);
    configureColor(Boolean(options.noColor));
    await runDiff(inputPath, options);
  });

  const inspectCmd = addShared(
    program.command("inspect [path]").description("Inspect invisible and metadata artifacts"),
  );
  inspectCmd.action(async (inputPath: string | undefined) => {
    const options = commandOptions(inspectCmd);
    configureColor(Boolean(options.noColor));
    await runInspect(inputPath, options);
  });

  const gitCmd = addShared(
    program
      .command("git")
      .description("Inspect git-changed files")
      .option("--staged", "Only inspect staged files"),
  );
  gitCmd.action(async () => {
    const options = commandOptions(gitCmd);
    configureColor(Boolean(options.noColor));
    await runGit({ ...options, staged: Boolean(gitCmd.opts().staged) });
  });

  const ciCmd = addShared(
    program.command("ci [path]").description("CI scan: exit 1 when watermarks are present"),
  );
  ciCmd.action(async (inputPath: string | undefined) => {
    const options = commandOptions(ciCmd);
    configureColor(Boolean(options.noColor));
    await runCi(inputPath, options);
  });

  const reportCmd = addShared(
    program
      .command("report [path]")
      .description("Write a scan report for audits and CI dashboards")
      .option("--report-format <format>", "Report format: markdown, json, sarif", "markdown"),
  );
  reportCmd.action(async (inputPath: string | undefined) => {
    const options = commandOptions(reportCmd);
    configureColor(Boolean(options.noColor));
    await runReport(inputPath ?? process.cwd(), options);
  });

  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  printError(error, false, false);
});
