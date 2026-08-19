import { z } from "zod";
import type { DetectionRule } from "../utils/types.js";

const LiteralMatchSchema = z.object({
  type: z.literal("literal"),
  value: z.string().min(1),
  caseInsensitive: z.boolean().optional(),
});

const RegexMatchSchema = z.object({
  type: z.literal("regex"),
  expression: z.string().min(1).max(500),
  flags: z.string().max(8).optional(),
});

const UnicodeMatchSchema = z.object({
  type: z.literal("unicode-sequence"),
  characters: z.array(z.string()).default([]),
  minRun: z.number().int().positive().optional(),
});

export const DetectionRuleSchema = z.object({
  id: z.string().min(1),
  provider: z.string().min(1),
  type: z.enum(["watermark", "attribution", "branding"]),
  match: z.discriminatedUnion("type", [LiteralMatchSchema, RegexMatchSchema, UnicodeMatchSchema]),
  confidence: z.number().min(0).max(1),
  action: z.enum(["remove", "report", "inspect"]),
  expandToLine: z.boolean().optional(),
  skipProtectedRanges: z.boolean().optional(),
});

export function parseRule(input: unknown): DetectionRule {
  return DetectionRuleSchema.parse(input);
}
