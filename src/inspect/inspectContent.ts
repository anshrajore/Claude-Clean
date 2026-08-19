import type { Detection } from "../utils/types.js";
import { ZERO_WIDTH_CODEPOINTS } from "../utils/text.js";

export interface InspectFinding {
  kind:
    | "zero-width"
    | "unexpected-unicode"
    | "html-comment"
    | "frontmatter"
    | "non-printing";
  start: number;
  end: number;
  detail: string;
  autoRemovable: boolean;
}

export function inspectContent(content: string, detections: Detection[]): InspectFinding[] {
  const findings: InspectFinding[] = [];
  for (let i = 0; i < content.length; i += 1) {
    const char = content[i]!;
    const code = char.codePointAt(0) ?? 0;
    if (ZERO_WIDTH_CODEPOINTS.includes(char)) {
      findings.push({
        kind: "zero-width",
        start: i,
        end: i + char.length,
        detail: `U+${code.toString(16).toUpperCase().padStart(4, "0")}`,
        autoRemovable: false,
      });
    } else if (code < 32 && char !== "\n" && char !== "\r" && char !== "\t") {
      findings.push({
        kind: "non-printing",
        start: i,
        end: i + char.length,
        detail: `U+${code.toString(16).toUpperCase().padStart(4, "0")}`,
        autoRemovable: false,
      });
    }
  }

  const comment = /<!--([\s\S]*?)-->/g;
  let match: RegExpExecArray | null = comment.exec(content);
  while (match) {
    findings.push({
      kind: "html-comment",
      start: match.index,
      end: match.index + match[0].length,
      detail: "HTML comment",
      autoRemovable: detections.some(
        (detection) => detection.start >= match!.index && detection.end <= match!.index + match![0].length,
      ),
    });
    match = comment.exec(content);
  }

  if (content.startsWith("---")) {
    const end = content.indexOf("\n---", 3);
    if (end !== -1) {
      findings.push({
        kind: "frontmatter",
        start: 0,
        end: end + 4,
        detail: "YAML frontmatter present",
        autoRemovable: false,
      });
    }
  }
  return findings;
}
