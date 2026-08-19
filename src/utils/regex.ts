const DANGEROUS_REGEX = /(\.\*){3,}|\(\.\*\)\+|(\+\*)|(\*\+)|\(\?.*\?.*\){3,}/;

export function assertSafeRegex(expression: string, flags = ""): RegExp {
  if (expression.length > 500) {
    throw new Error("Regex expression is too long.");
  }
  if (DANGEROUS_REGEX.test(expression)) {
    throw new Error("Regex expression looks unbounded and was rejected.");
  }
  const normalizedFlags = flags.replace(/[^gimsuy]/g, "");
  const flagsWithGlobal = normalizedFlags.includes("g") ? normalizedFlags : `${normalizedFlags}g`;
  return new RegExp(expression, flagsWithGlobal);
}

export function collectRegexMatches(
  regex: RegExp,
  content: string,
  maxMatches = 10_000,
): Array<{ start: number; end: number; text: string }> {
  const matches: Array<{ start: number; end: number; text: string }> = [];
  regex.lastIndex = 0;
  let match: RegExpExecArray | null = regex.exec(content);
  let iterations = 0;
  while (match) {
    iterations += 1;
    if (iterations > maxMatches) {
      break;
    }
    if (match[0] === "") {
      regex.lastIndex += 1;
      match = regex.exec(content);
      continue;
    }
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
    });
    match = regex.exec(content);
  }
  return matches;
}

export function collectLiteralMatches(
  value: string,
  content: string,
  caseInsensitive: boolean,
): Array<{ start: number; end: number; text: string }> {
  if (!value) {
    return [];
  }
  const haystack = caseInsensitive ? content.toLowerCase() : content;
  const needle = caseInsensitive ? value.toLowerCase() : value;
  const matches: Array<{ start: number; end: number; text: string }> = [];
  let from = 0;
  while (from <= haystack.length) {
    const index = haystack.indexOf(needle, from);
    if (index === -1) {
      break;
    }
    matches.push({
      start: index,
      end: index + value.length,
      text: content.slice(index, index + value.length),
    });
    from = index + Math.max(value.length, 1);
  }
  return matches;
}
