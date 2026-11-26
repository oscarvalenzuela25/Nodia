import { describe, expect, it } from "vitest";
import { cvAiEditFormSchema, cvAiEditMaxBytes } from "../../../../modules/nodiaCv/infrastructure/cvAiEdit";

describe("CV AI edit instruction validation", () => {
  it("applies the same Unicode, newline and byte limits as the edit DTO", () => {
    expect(cvAiEditFormSchema.parse({ instructions: "  Cafe\u0301\r\nProyectos  " }).instructions)
      .toBe("Café\nProyectos");
    expect(cvAiEditFormSchema.safeParse({ instructions: "é".repeat(cvAiEditMaxBytes / 2) }).success).toBe(true);
    expect(cvAiEditFormSchema.safeParse({ instructions: "é".repeat(cvAiEditMaxBytes / 2 + 1) }).success).toBe(false);
    expect(cvAiEditFormSchema.safeParse({ instructions: "Oculto\u202E" }).success).toBe(false);
    expect(cvAiEditFormSchema.safeParse({ instructions: "  " }).success).toBe(false);
  });
});
