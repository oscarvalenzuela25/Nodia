import { mainInstance } from "../../../config/api";
import { apiPath } from "../../../config/apiPath";
import i18n from "../../../translate";
import { CvPdfIntegrityError, verifyCvPdfBytes } from "./pdfVersions";
import type { CvGenerationView } from "./useCvGenerationWorkflow";

export type CvApplicationDocumentKind = "cover" | "recommendation";
type ApplicationDocumentInput = { revision: number; kind: CvApplicationDocumentKind; text: string };
type ApplicationDocumentSource = {
  profile: Pick<CvGenerationView["profile"], "full_name">;
  receipt: Pick<CvGenerationView["receipt"], "language" | "vacancy_title" | "vacancy_company" | "draft" | "review">;
};
const root = apiPath("/nodia-cv");
const relevantFactFields = new Set(["experience.highlights", "project.contributions", "profile.summary"]);
const technologyFactFields = new Set(["experience.technologies", "project.technologies", "skills.skills", "profile.main_stack"]);
export const applicationDocumentTextLimit = 3000;
export const recommendationPdfLimit = 10_000_000;

export function applicationLetterDrafts({ profile, receipt }: ApplicationDocumentSource) {
  const t = i18n.getFixedT(receipt.language, "nodiaCv");
  const { draft, review } = receipt;
  const indexedFacts = new Map([...(draft?.selectedFacts ?? []), ...(draft?.remainingFacts ?? [])]
    .map((fact) => [fact.id, fact]));
  const technologies = review?.technologies;
  const facts = (review?.included_fact_ids ?? []).flatMap((id) => {
    const fact = indexedFacts.get(id);
    if (!fact) return [];
    const field = `${fact.section}.${fact.field}`;
    return relevantFactFields.has(field) || (!technologies && technologyFactFields.has(field)) ? [fact.text] : [];
  });
  const confirmed = receipt.review?.evidence.map(({ detail }) => detail) ?? [];
  const includedTechnologies = new Set(technologies?.included);
  const confirmedTechnologies = technologies?.additions.flatMap((item) =>
    item.status === "confirmed" && includedTechnologies.has(item.name) ? [item.detail] : [],
  ) ?? [];
  const evidence = [...new Set([...facts, ...confirmed, ...confirmedTechnologies, ...includedTechnologies]
    .map((fact) => fact.replace(/\s+/gu, " ").trim())
    .filter((fact) => fact.length <= 220 && /[\p{L}\p{N}]/u.test(fact)))].slice(0, 3);
  const bulletedEvidence = evidence.map((fact) => `• ${fact}`).join("\n");
  const role = receipt.vacancy_title;
  const company = receipt.vacancy_company;
  const opening = role && company ? t("application_documents.cover_role_company", { role, company })
    : role ? t("application_documents.cover_role", { role })
    : company ? t("application_documents.cover_company", { company }) : t("application_documents.cover_general");
  return {
    cover: [
      t("application_documents.cover_greeting"), opening,
      bulletedEvidence && `${t("application_documents.cover_facts")}\n${bulletedEvidence}`,
      t("application_documents.cover_closing"),
      `${t("application_documents.cover_signature")}\n${profile.full_name}`,
    ].filter(Boolean).join("\n\n"),
    recommendation: [
      t("application_documents.recommendation_context", { name: profile.full_name }),
      bulletedEvidence && `${t("application_documents.recommendation_facts")}\n${bulletedEvidence}`,
      t("application_documents.recommendation_relationship"),
      t("application_documents.recommendation_review"),
      t("application_documents.recommendation_signer"),
    ].filter(Boolean).join("\n\n"),
  };
}

export function isApplicationDocumentText(value: string) {
  const text = value.normalize("NFC").replace(/\r\n?/g, "\n").trim();
  return text.length <= applicationDocumentTextLimit &&
    text.split("\n").filter((line) => line.trim()).length <= 28 &&
    !/[\p{Cc}\p{Cs}\p{Bidi_Control}]/u.test(text.replaceAll("\n", "")) &&
    /[\p{L}\p{N}]/u.test(text);
}

export async function isRecommendationPdf(file: File) {
  if (!/\.pdf$/i.test(file.name) || !["", "application/pdf", "application/octet-stream"].includes(file.type) ||
    file.size < 10 || file.size > recommendationPdfLimit) return false;
  const [header, ending] = await Promise.all([
    file.slice(0, 5).text(),
    file.slice(Math.max(0, file.size - 2048)).text(),
  ]);
  return header === "%PDF-" && ending.trimEnd().endsWith("%%EOF");
}

export async function renderCvApplicationDocument(
  generationId: string, input: ApplicationDocumentInput, { version, signal }: { version: number; signal: AbortSignal },
) {
  const response = await mainInstance.post<unknown>(`${root}/drafts/${generationId}/application-documents/pdf`, input, {
    expectedAuthSessionVersion: version, signal, responseType: "arraybuffer",
  });
  const hash: unknown = response.headers["x-content-sha256"];
  if (typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash)) throw new CvPdfIntegrityError();
  return verifyCvPdfBytes(response.data, response.headers["content-type"], hash, hash);
}
