import { describe, expect, it } from "vitest";
import i18n from "../../../../translate";
import type { CvDraftFact } from "../../../../modules/nodiaCv/infrastructure/generationSchema";
import { cvExperiencePresentation } from "../../../../modules/nodiaCv/infrastructure/experiencePresentation";

function experience(entries: Record<string, string>): CvDraftFact[] {
  return Object.entries(entries).map(([field, text], index) => ({
    id: "e" + (index + 1),
    section: "experience",
    groupId: "experience:1",
    field,
    text,
  }));
}

describe("CV employment presentation", () => {
  it("keeps company and role together and preserves both reviewed months in one range", () => {
    const presented = cvExperiencePresentation(
      experience({
        position: "Software Engineer",
        company: "Cinderfield Systems",
        status: "finished",
        end_month: "2024-09",
        start_month: "2021-04",
        highlights: "Reviewed TypeScript releases",
      }),
      i18n.getFixedT("en", "nodiaCv"),
    );

    expect(presented.heading?.text).toBe("Cinderfield Systems");
    expect(presented.lines.map(({ text }) => text)).toEqual([
      "Software Engineer",
      "04/2021 - 09/2024",
      "Reviewed TypeScript releases",
    ]);
  });

  it("labels a known start without assuming an unknown end and expresses only explicit current status", () => {
    const t = i18n.getFixedT("es", "nodiaCv");
    const dates = (status: string, start = "2021-04") =>
      cvExperiencePresentation(
        experience({ position: "Ingeniera", status, ...(start ? { start_month: start } : {}) }),
        t,
      ).lines.map(({ text }) => text);

    expect(dates("unspecified")).toEqual(["Inicio: 04/2021"]);
    expect(dates("current")).toEqual(["04/2021 - Actualidad"]);
    expect(dates("finished")).toEqual(["Inicio: 04/2021", "Estado: Finalizado"]);
    expect(dates("current", "")).toEqual(["Estado: Actualidad"]);
    expect(dates("unspecified", "")).toEqual([]);
  });
});
