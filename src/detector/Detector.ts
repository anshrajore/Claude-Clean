import type { Detection, DetectionContext } from "../utils/types.js";

export interface Detector {
  id: string;
  name: string;
  detect(content: string, context: DetectionContext): Detection[];
}
