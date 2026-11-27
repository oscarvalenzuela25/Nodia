import type { TFunction } from "i18next";
import { cvExperiencePresentation } from "../../infrastructure/experiencePresentation";
import type { CvDraftFact, CvRequirement } from "../../infrastructure/generationSchema";
import type { CvGenerationView } from "../../infrastructure/useCvGenerationWorkflow";

type Line = { id: string; text: string; evidenceFactIds?: string[] };
type FactGroup = { section: CvDraftFact["section"]; facts: CvDraftFact[] };
const sections: CvDraftFact["section"][] = [
  "profile", "experience", "project", "skills", "education", "certification", "language", "additional",
];
const primaryFields = ["title", "name", "language"];

export const cvLineFactIds = (line: Line) => line.evidenceFactIds ?? [line.id];

export function cvPreviewPresentation(view: CvGenerationView, t: TFunction<"nodiaCv">) {
  const { draft, review, technology_options: options } = view.receipt;
  if (!draft) return null;

  const indexed = new Map([...draft.selectedFacts, ...draft.remainingFacts].map((fact) => [fact.id, fact]));
  const included = review?.included_fact_ids ?? draft.selectedFacts.map((fact) => fact.id);
  const groups = new Map<string, FactGroup>();
  const titleFactIds = [...indexed.values()].filter((fact) =>
    fact.section === "profile" && fact.field === "professional_title" && fact.text === view.profile.professional_title,
  ).map(({ id }) => id);
  const fixedTitleFacts = new Set(titleFactIds);
  for (const id of included) {
    const fact = indexed.get(id);
    if (!fact || fixedTitleFacts.has(id)) continue;
    const mainStack = fact.section === "profile" && fact.field === "main_stack";
    if (mainStack && review?.technologies) continue;
    const section = mainStack ? "skills" : fact.section;
    const key = `${section}:${fact.groupId}`;
    const group = groups.get(key) ?? { section, facts: [] };
    group.facts.push(fact);
    groups.set(key, group);
  }

  const renderedFactIds = new Set(titleFactIds);
  const orderedSections = new Set([...(review?.section_order ?? []), ...sections]);
  const bySection = Array.from(orderedSections, (section) => {
    const presentedGroups = [...groups].filter(([, group]) => group.section === section).map(([id, group]) => {
      const { heading, lines } = section === "experience"
        ? cvExperiencePresentation(group.facts, t)
        : { heading: group.facts.find((fact) => primaryFields.includes(fact.field)), lines: group.facts };
      if (heading) renderedFactIds.add(heading.id);
      const body = lines.filter((line) => line.id !== heading?.id);
      for (const line of body) cvLineFactIds(line).forEach((factId) => renderedFactIds.add(factId));
      return { id, heading, lines: body };
    });
    return { section, groups: presentedGroups };
  }).filter(({ section, groups }) => groups.length > 0 || (section === "skills" && Boolean(review?.technologies?.included.length)));

  const technologyLinks = new Map(options?.map(({ name, requirement_ids }) => [name, requirement_ids]));
  const technologies = review?.technologies?.included.map((name) => ({
    name, requirementIds: technologyLinks.get(name) ?? [],
  })) ?? [];
  const includedTechnologyNames = new Set(technologies.map(({ name }) => name));
  const confirmed = [
    ...(review?.evidence ?? []).map((item) => ({
      key: item.requirement_id, source: item.source, detail: item.detail, requirementIds: [item.requirement_id],
    })),
    ...(review?.technologies?.additions ?? []).flatMap((item) =>
      item.status === "confirmed" && includedTechnologyNames.has(item.name) && item.source && item.detail
        ? [{ key: `technology:${item.name}`, source: item.source, detail: item.detail,
            requirementIds: technologyLinks.get(item.name) ?? [] }]
        : [],
    ),
  ];
  const confirmedRequirements = new Set(confirmed.flatMap(({ requirementIds }) => requirementIds));
  const linkedRequirements = new Set([...confirmedRequirements, ...technologies.flatMap(({ requirementIds }) => requirementIds)]);
  for (const requirement of draft.requirements) {
    if (requirement.evidenceIds.some((id) => renderedFactIds.has(id))) linkedRequirements.add(requirement.id);
  }
  return { titleFactIds, bySection, technologies, confirmed, confirmedRequirements, linkedRequirements };
}

export type CvPreviewPresentation = NonNullable<ReturnType<typeof cvPreviewPresentation>>;

export function cvPreviewCoverage(requirement: CvRequirement, presentation: Pick<CvPreviewPresentation, "confirmedRequirements" | "linkedRequirements">) {
  if (presentation.confirmedRequirements.has(requirement.id)) return "supported";
  if (requirement.coverage === "supported" || requirement.coverage === "omitted") {
    return presentation.linkedRequirements.has(requirement.id) ? "supported" : "omitted";
  }
  return requirement.coverage;
}
