import { describe, expect, it } from "vitest";
import { findStudyFragments } from "../../../../../modules/teacher/components/StudyFragmentPilot/findStudyFragments";

const vowels = { id: "vowels", title: "Letras, sonidos y palabras", body_markdown: "Compara «sit» /sɪt/ y «seat» /si:t/." };
const spelling = { id: "spelling", title: "Deletrear sin omitir caracteres", body_markdown: "Identificador **BEE–22**." };

describe("findStudyFragments", () => {
  it("uses both exact topics from one material version and returns their saved block IDs", () => {
    expect(findStudyFragments([spelling, { id: "other", title: "Repaso", body_markdown: vowels.body_markdown }, vowels]))
      .toEqual({ vowels: "vowels", spelling: "spelling" });
    expect(findStudyFragments([
      { ...vowels, body_markdown: vowels.body_markdown.replace("/si:t/", "/siːt/") },
      { ...spelling, body_markdown: "BEE-22" },
    ])).toEqual({ vowels: "vowels", spelling: "spelling" });
  });

  it("keeps legacy, partial and ambiguous material on the standard reader", () => {
    expect(findStudyFragments([])).toBeNull();
    expect(findStudyFragments([vowels])).toBeNull();
    expect(findStudyFragments([vowels, { ...spelling, body_markdown: "Identificador BEE–222." }])).toBeNull();
    expect(findStudyFragments([{ ...vowels, title: "Sonidos y palabras" }, spelling])).toBeNull();
    expect(findStudyFragments([{ ...vowels, body_markdown: "Compara «sit» y «seat»." }, spelling])).toBeNull();
    expect(findStudyFragments([vowels, spelling, { ...spelling, id: "duplicate" }])).toBeNull();
  });
});
