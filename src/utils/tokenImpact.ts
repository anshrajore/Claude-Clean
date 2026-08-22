import type { TokenImpact } from "./types.js";

const AVERAGE_CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  if (text.length === 0) {
    return 0;
  }
  return Math.max(1, Math.ceil(text.length / AVERAGE_CHARS_PER_TOKEN));
}

export function calculateTokenImpact(original: string, cleaned: string): TokenImpact {
  const originalCharacters = original.length;
  const cleanedCharacters = cleaned.length;
  const removedCharacters = Math.max(0, originalCharacters - cleanedCharacters);
  const estimatedOriginalTokens = estimateTokens(original);
  const estimatedCleanedTokens = estimateTokens(cleaned);
  const estimatedTokensSaved = Math.max(0, estimatedOriginalTokens - estimatedCleanedTokens);
  return {
    originalCharacters,
    cleanedCharacters,
    removedCharacters,
    estimatedOriginalTokens,
    estimatedCleanedTokens,
    estimatedTokensSaved,
    reductionRatio: originalCharacters === 0 ? 0 : removedCharacters / originalCharacters,
  };
}
