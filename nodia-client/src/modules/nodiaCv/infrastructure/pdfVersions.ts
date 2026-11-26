import { z } from "zod";
import { mainInstance } from "../../../config/api";
import { apiPath } from "../../../config/apiPath";
import { cvSavedAnalysisSchema } from "./generationSchema";

const root = apiPath("/nodia-cv");
const template = z.enum(["classic", "compact"]);
const language = z.enum(["es", "en"]);
const pdfDetails = z.object({
  format: z.literal("a4"),
  renderer: z.string().min(1).max(120),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  page_count: z.int().min(1).max(4),
  extracted_text: z.string().min(1).max(64 * 1024).refine((text) => !!text.trim()),
  missing_contact: z.boolean(),
});

const artifactSchema = pdfDetails.extend({
  id: z.uuidv4(),
  generation_id: z.uuidv4(),
  revision: z.int().positive(),
  template,
  language,
  expires_at: z.iso.datetime(),
});
const versionSummarySchema = z.object({
  id: z.uuidv4(),
  version_number: z.int().positive(),
  profile_name: z.string().min(1).max(240),
  vacancy_title: z.string().nullable(),
  vacancy_company: z.string().nullable(),
  language,
  template,
  created_at: z.iso.datetime(),
});
const versionDetailSchema = versionSummarySchema.extend({
  ...pdfDetails.shape,
  analysis: cvSavedAnalysisSchema.nullish().transform((analysis) => analysis ?? null),
});
const pageSchema = z.object({
  items: z.array(versionSummarySchema).max(10),
  page: z.int().positive(),
  limit: z.literal(10),
  total: z.int().nonnegative(),
});

export type CvPdfTemplate = z.infer<typeof template>;
export type CvPdfDescription = z.infer<typeof pdfDetails>;
export type CvPdfArtifact = z.infer<typeof artifactSchema>;
export type CvVersionSummary = z.infer<typeof versionSummarySchema>;
export type CvVersionDetail = z.infer<typeof versionDetailSchema>;
export type CvVerifiedBytes = { buffer: ArrayBuffer; sha256: string };
export const cvVersionsPageSize = 10;

type ReadContext = { version: number; signal?: AbortSignal };
const auth = ({ version, signal }: ReadContext) => ({ expectedAuthSessionVersion: version, signal });

export class CvPdfIntegrityError extends Error {
  constructor() {
    super("Unverified Nodia CV PDF");
    this.name = "CvPdfIntegrityError";
  }
}

export async function verifyCvPdfBytes(
  data: unknown,
  declaredType: unknown,
  declaredHash: unknown,
  expectedHash: string,
): Promise<CvVerifiedBytes> {
  if (
    !(data instanceof ArrayBuffer) || data.byteLength < 5 || data.byteLength > 256 * 1024 ||
    typeof declaredType !== "string" || declaredType.split(";")[0]?.trim().toLowerCase() !== "application/pdf" ||
    declaredHash !== expectedHash || !globalThis.crypto?.subtle ||
    new TextDecoder().decode(new Uint8Array(data, 0, 5)) !== "%PDF-"
  ) throw new CvPdfIntegrityError();
  const digest = await crypto.subtle.digest("SHA-256", data);
  const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  if (sha256 !== expectedHash) throw new CvPdfIntegrityError();
  return { buffer: data, sha256 };
}

export async function prepareCvPdf(
  generationId: string,
  input: { revision: number; template: CvPdfTemplate; language: CvPdfArtifact["language"] },
  context: ReadContext,
) {
  const { revision, template, language } = input;
  const response = await mainInstance.post<unknown>(
    `${root}/drafts/${generationId}/pdf`, { revision, template }, auth(context),
  );
  const pdf = artifactSchema.parse(response.data);
  if (pdf.generation_id !== generationId || pdf.revision !== revision || pdf.template !== template || pdf.language !== language)
    throw new CvPdfIntegrityError();
  return pdf;
}

async function fetchPdf(path: string, expected: string, context: ReadContext) {
  const response = await mainInstance.get<unknown>(path, { ...auth(context), responseType: "arraybuffer" });
  return verifyCvPdfBytes(response.data, response.headers["content-type"], response.headers["x-content-sha256"], expected);
}

export const fetchCvDraftPdf = (artifact: CvPdfArtifact, context: ReadContext) =>
  fetchPdf(`${root}/drafts/${artifact.generation_id}/pdf/${artifact.id}`, artifact.sha256, context);

export const fetchCvVersionPdf = (version: Pick<CvVersionDetail, "id" | "sha256">, context: ReadContext) =>
  fetchPdf(`${root}/versions/${version.id}/pdf`, version.sha256, context);

export async function saveCvVersion(artifact: CvPdfArtifact, requestKey: string, context: ReadContext) {
  const result = await mainInstance.post<unknown>(`${root}/versions`, {
    request_key: requestKey, generation_id: artifact.generation_id, revision: artifact.revision,
    artifact_id: artifact.id, sha256: artifact.sha256,
  }, auth(context));
  const version = versionDetailSchema.parse(result.data);
  if (
    version.sha256 !== artifact.sha256 || version.template !== artifact.template || version.language !== artifact.language ||
    version.format !== artifact.format || version.renderer !== artifact.renderer || version.page_count !== artifact.page_count ||
    version.extracted_text !== artifact.extracted_text || version.missing_contact !== artifact.missing_contact
  ) throw new CvPdfIntegrityError();
  return version;
}

export async function listCvVersions(page: number, context: ReadContext) {
  const response = await mainInstance.get<unknown>(`${root}/versions`, {
    ...auth(context), params: { page, limit: cvVersionsPageSize },
  });
  const result = pageSchema.parse(response.data);
  if (result.page !== page || new Set(result.items.map(({ id }) => id)).size !== result.items.length)
    throw new Error("Unexpected Nodia CV versions page");
  return result;
}

export async function readCvVersion(id: string, context: ReadContext) {
  const response = await mainInstance.get<unknown>(`${root}/versions/${id}`, auth(context));
  const result = versionDetailSchema.parse(response.data);
  if (result.id !== id) throw new CvPdfIntegrityError();
  return result;
}

export async function deleteCvVersion(id: string, context: ReadContext) {
  await mainInstance.delete(`${root}/versions/${id}`, auth(context));
}
