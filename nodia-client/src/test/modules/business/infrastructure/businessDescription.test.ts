import { describe, expect, it } from "vitest";
import { getBusinessDescription } from "../../../../modules/business/infrastructure/businessDescription";

describe("single business description", () => {
  it("prefers the description key over historical comments and names", () => {
    expect(getBusinessDescription({ translates: [
      { key: "name", es: "Name", en: "Name" },
      { key: "comment", es: "Legacy", en: "Legacy" },
      { key: "description", es: "Descripción", en: "Historical translation" },
    ] })).toBe("Descripción");
  });
  it("reads an English-only legacy comment until the next explicit save", () => {
    expect(getBusinessDescription({ translates: [{ key: "comment", es: "", en: "English only" }] })).toBe("English only");
  });
  it("does not resurrect a legacy comment after the description was cleared", () => {
    expect(getBusinessDescription({ translates: [
      { key: "comment", es: "Old comment", en: "Old comment" },
      { key: "description", es: "", en: "" },
    ] })).toBe("");
    expect(getBusinessDescription()).toBe("");
  });
});
