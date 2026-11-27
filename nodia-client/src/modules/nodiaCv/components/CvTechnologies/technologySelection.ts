import type {
  CvGeneration,
  CvTechnologyAddition,
  CvTechnologyOption,
  CvTechnologyReview,
} from "../../infrastructure/generationSchema";

export function technologyGroup(row: CvTechnologyOption) {
  if (!row.in_profile) return "missing";
  return row.kind === "outside" ? "other" : "matched";
}

export function technologyRows(
  options: readonly CvTechnologyOption[],
  additions: readonly CvTechnologyAddition[],
): CvTechnologyOption[] {
  const names = new Set(options.map(({ name }) => name));
  return [
    ...options,
    ...additions.filter(({ name }) => !names.has(name)).map(({ name }) => ({
      name,
      kind: "outside" as const,
      in_profile: false,
      requirement_ids: [],
    })),
  ];
}

export function initialCvTechnologies(receipt: CvGeneration): CvTechnologyReview {
  if (receipt.review?.technologies) return receipt.review.technologies;
  const options = receipt.technology_options ?? [];
  if (!receipt.review || !receipt.draft) return { included: [], additions: [] };
  const included = new Set(receipt.review.included_fact_ids);
  const names = new Set(
    [...receipt.draft.selectedFacts, ...receipt.draft.remainingFacts]
      .filter((fact) => included.has(fact.id) && ["main_stack", "technologies", "skills"].includes(fact.field))
      .flatMap(({ text }) => text.split(/[,;|•\n]/u).map((term) => term.trim().toLowerCase())),
  );
  return { included: options.filter(({ name, in_profile }) => in_profile && names.has(name.toLowerCase())).map(({ name }) => name), additions: [] };
}

export function rebaseCvTechnologies(
  baseline: CvTechnologyReview,
  edited: CvTechnologyReview,
  latest: CvTechnologyReview,
): CvTechnologyReview {
  const included = new Set(latest.included);
  for (const name of baseline.included) if (!edited.included.includes(name)) included.delete(name);
  for (const name of edited.included) if (!baseline.included.includes(name)) included.add(name);
  const additions = new Map(latest.additions.map((item) => [item.name, item]));
  for (const item of baseline.additions) {
    if (!edited.additions.some(({ name }) => name === item.name)) additions.delete(item.name);
  }
  for (const item of edited.additions) {
    const previous = baseline.additions.find(({ name }) => name === item.name);
    if (JSON.stringify(previous) !== JSON.stringify(item)) additions.set(item.name, item);
  }
  return { included: [...included], additions: [...additions.values()] };
}
