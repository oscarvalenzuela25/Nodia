import { z } from "zod";

export const artifactTools = ["nodia_products_export_csv", "nodia_providers_export_csv", "nodia_invoices_file"] as const;
export type NodiaAiArtifactTool = typeof artifactTools[number];
export function isNodiaAiArtifactTool(value: string): value is NodiaAiArtifactTool {
  return artifactTools.some(tool => tool === value);
}
export const artifactRefSchema = z.object({
  tool_call_id: z.uuidv4(), tool_name: z.enum(artifactTools), contract_hash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export type NodiaAiArtifactRef = z.infer<typeof artifactRefSchema>;

// A client safeguard matching Nodia's file policy, not a provider quota or an XHR memory guarantee.
export const ARTIFACT_MAX_BYTES = 20 * 1024 * 1024;
const invoiceMimes: Record<string, string> = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
export function artifactResponseMetadata(tool: NodiaAiArtifactTool, disposition: unknown, contentType: unknown) {
  if (typeof disposition !== "string" || typeof contentType !== "string") throw new Error("nodia_ai:invalid_response");
  const filename = /^attachment;\s*filename="([A-Za-z0-9_-]+\.(?:csv|pdf|png|jpg|jpeg|webp))"$/i.exec(disposition)?.[1];
  if (!filename || filename.length > 80) throw new Error("nodia_ai:invalid_response");
  const mime = contentType.toLowerCase().replace(/\s/g, "");
  if (tool === "nodia_invoices_file") {
    const invoice = /^invoice-[1-9]\d{0,18}\.(pdf|png|jpg|jpeg|webp)$/.exec(filename);
    if (!invoice || mime !== invoiceMimes[invoice[1]]) throw new Error("nodia_ai:invalid_response");
  } else if (filename !== (tool === "nodia_products_export_csv" ? "products.csv" : "providers.csv") || mime !== "text/csv;charset=utf-8") {
    throw new Error("nodia_ai:invalid_response");
  }
  return { filename, mime };
}
