import { describe, expect, it } from "vitest";
import { rebaseCvTechnologies, technologyRows } from "../../../../../modules/nodiaCv/components/CvTechnologies/technologySelection";

describe("technology selections", () => {
  it("shows an added technology once without losing the requirement it came from", () => {
    const candidates = [{ name: "Kubernetes", kind: "preferred" as const, in_profile: false, requirement_ids: ["r1"] }];
    const rows = technologyRows(candidates, [
      { name: "Kubernetes", status: "study" },
      { name: "Dagger", status: "confirmed", source: "QA", detail: "Built a pipeline." },
    ]);
    expect(rows).toEqual([
      candidates[0],
      { name: "Dagger", kind: "outside", in_profile: false, requirement_ids: [] },
    ]);
  });

  it("rebases only the local differences on the latest review after a conflict", () => {
    const base = { included: ["TypeScript", "React"], additions: [] };
    const edited = { included: ["TypeScript"], additions: [{ name: "Docker", status: "study" as const }] };
    const latest = { included: ["TypeScript", "React", "Redis"], additions: [] };
    expect(rebaseCvTechnologies(base, edited, latest)).toEqual({
      included: ["TypeScript", "Redis"], additions: [{ name: "Docker", status: "study" }],
    });
  });
});
