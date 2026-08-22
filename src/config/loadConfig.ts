import { promises as fs } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { z } from "zod";
import { AppError } from "../utils/types.js";

export const ConfigSchema = z.object({
  version: z.number().int().positive().default(1),
  profile: z.enum(["strict", "balanced", "aggressive"]).default("balanced"),
  confidence: z
    .object({
      automaticRemoval: z.number().min(0).max(1).default(0.99),
      preview: z.number().min(0).max(1).default(0.9),
      report: z.number().min(0).max(1).default(0.7),
    })
    .default({}),
  processing: z
    .object({
      includeCode: z.boolean().default(false),
      backup: z.boolean().default(false),
      maxFileBytes: z
        .number()
        .int()
        .positive()
        .default(10 * 1024 * 1024),
      maxDeletionRatio: z.number().min(0).max(1).default(0.5),
    })
    .default({}),
  output: z
    .object({
      suffix: z.string().min(1).default(".cleaned"),
    })
    .default({}),
  rules: z
    .object({
      enabled: z.array(z.string()).default(["claude", "generic"]),
      extraDirs: z.array(z.string()).default([]),
    })
    .default({}),
  ignore: z.array(z.string()).default([]),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export async function loadConfig(cwd = process.cwd()): Promise<AppConfig> {
  const candidates = [".claude-clean.yml", ".claude-clean.yaml", ".claude-clean.json"];
  for (const candidate of candidates) {
    const full = path.join(cwd, candidate);
    try {
      const raw = await fs.readFile(full, "utf8");
      const parsed = candidate.endsWith(".json") ? JSON.parse(raw) : yaml.load(raw);
      return ConfigSchema.parse(parsed ?? {});
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }
      if (error instanceof z.ZodError) {
        throw new AppError("CONFIG_INVALID", `Invalid configuration: ${error.message}`);
      }
      throw error;
    }
  }
  return ConfigSchema.parse({});
}
