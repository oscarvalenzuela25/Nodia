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
  const lines: { id: string; text: string }[] = [];
  if (position && company) lines.push(position);
  if (start && end) lines.push({ id: "period", text: start + " - " + end });
  else if (status === "current" && start)
    lines.push({ id: "period", text: t("document_experience.current_period", { start }) });
  else if (start) lines.push({ id: "period", text: t("document_experience.start", { date: start }) });
  else if (end) lines.push({ id: "period", text: t("document_experience.end", { date: end }) });

  if (status === "current" && !start)
    lines.push({ id: "state", text: t("document_experience.current_status") });
  if (status === "finished" && !end)
    lines.push({ id: "state", text: t("document_experience.finished_status") });
  lines.push(...facts.filter((fact) => !anchorFields.has(fact.field)));
  return { heading: company ?? position, lines };
}
