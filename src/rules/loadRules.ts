import { promises as fs } from "node:fs";
import path from "node:path";
import { AppError, type DetectionRule } from "../utils/types.js";
import { packageRoot } from "../utils/paths.js";
import { parseRule } from "./schema.js";

export async function loadRules(enabledProviders: string[], extraDirs: string[] = []): Promise<DetectionRule[]> {
  const roots = [path.join(packageRoot(), "rules"), ...extraDirs];
  const rules: DetectionRule[] = [];
  const seen = new Set<string>();

  for (const root of roots) {
    let providers: string[] = [];
    try {
      providers = await fs.readdir(root);
    } catch {
      continue;
    }
    for (const provider of providers) {
      if (enabledProviders.length > 0 && !enabledProviders.includes(provider)) {
        continue;
      }
      const dir = path.join(root, provider);
      let files: string[] = [];
      try {
        files = await fs.readdir(dir);
      } catch {
        continue;
      }
      for (const file of files) {
        if (!file.endsWith(".json")) {
          continue;
        }
        const full = path.join(dir, file);
        const parsed = parseRule(JSON.parse(await fs.readFile(full, "utf8")) as unknown);
        if (seen.has(parsed.id)) {
          throw new AppError("RULE_DUPLICATE", `Duplicate rule id: ${parsed.id}`);
        }
        seen.add(parsed.id);
        rules.push(parsed);
      }
    }
  }

  if (rules.length === 0) {
    throw new AppError("RULES_MISSING", "No detection rules were loaded.");
  }
  return rules;
}
