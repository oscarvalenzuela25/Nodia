import type { BusinessEntity } from "./types";

// A business now has one description. Prefer the canonical key; an explicit
// empty description must not resurrect a legacy comment or another label.
export function getBusinessDescription(business?: Pick<BusinessEntity, "translates"> | null): string {
  const records = business?.translates;
  const description = records?.find((item) => item.key === "description")
    ?? records?.find((item) => item.key === "comment");
  return description?.es || description?.en || "";
}
