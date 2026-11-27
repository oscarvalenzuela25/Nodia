import type { TFunction } from "i18next";
import type { CvDraftFact } from "./generationSchema";

const anchorFields = new Set(["company", "position", "start_month", "end_month", "status"]);

function monthForDocument(value: string | undefined) {
  return value?.replace(/^(\d{4})-(0[1-9]|1[0-2])$/, "$2/$1");
}

export function cvExperiencePresentation(facts: CvDraftFact[], t: TFunction<"nodiaCv">) {
  const byField = new Map(facts.map((fact) => [fact.field, fact]));
  const company = byField.get("company");
  const position = byField.get("position");
  const start = monthForDocument(byField.get("start_month")?.text);
  const end = monthForDocument(byField.get("end_month")?.text);
  const status = byField.get("status")?.text;
  const lines: { id: string; text: string; evidenceFactIds?: string[] }[] = [];
  const addLine = (id: string, text: string, ...fields: string[]) => {
    const evidenceFactIds = fields.flatMap((field) => {
      const fact = byField.get(field);
      return fact ? [fact.id] : [];
    });
    lines.push({ id, text, evidenceFactIds });
  };
  if (position && company) lines.push(position);
  if (start && end) addLine("period", start + " - " + end, "start_month", "end_month");
  else if (status === "current" && start)
    addLine("period", t("document_experience.current_period", { start }), "start_month", "status");
  else if (start) addLine("period", t("document_experience.start", { date: start }), "start_month");
  else if (end) addLine("period", t("document_experience.end", { date: end }), "end_month");

  if (status === "current" && !start)
    addLine("state", t("document_experience.current_status"), "status");
  if (status === "finished" && !end)
    addLine("state", t("document_experience.finished_status"), "status");
  lines.push(...facts.filter((fact) => !anchorFields.has(fact.field)));
  return { heading: company ?? position, lines };
}
