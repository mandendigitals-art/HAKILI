declare module "pdf-parse/lib/pdf-parse.js" {
  import type { Buffer } from "node:buffer";
  function pdfParse(buffer: Buffer, options?: Record<string, unknown>): Promise<{ text: string; numpages: number; info?: unknown }>;
  export default pdfParse;
}
