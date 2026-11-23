import { describe, expect, it } from "vitest";
import { fitsFlashcardImportRequest, parseFlashcardImport } from "../../../../modules/teacher/infrastructure/flashcardImport";

const card = { question: " ¿Qué significa hill? ", answer: " Colina. ", source: " Vocabulario " };

describe("flashcard import format", () => {
  it("reads one card and a fenced deck, normalizing human text", () => {
    const single = parseFlashcardImport(JSON.stringify({ version: 1, cards: [card] }));
    expect(single.plan).toEqual({ version: 1, cards: [{ question: "¿Qué significa hill?", answer: "Colina.", source: "Vocabulario" }] });
    const json = JSON.stringify({ version: 1, deck: { title: "  Ｉnglés   diario ", category: " Idiomas " }, cards: [card] });
    const fence = String.fromCharCode(96).repeat(3);
    expect(parseFlashcardImport(fence + "json\n" + json + "\n" + fence).plan?.deck)
      .toEqual({ title: "Inglés diario", category: "Idiomas" });
  });

  it("identifies an invalid card with unexpected image fields or malformed text", () => {
    const parsed = parseFlashcardImport(JSON.stringify({
      version: 1, cards: [card, { ...card, image: "https://example.test/picture.png" }],
    }));
    expect(parsed.issue).toEqual({ code: "card", index: 2 });
    const invalid = parseFlashcardImport(JSON.stringify({
      version: 1, cards: [{ ...card, answer: "bad\ud800" }],
    }));
    expect(invalid.issue).toEqual({ code: "card", index: 1 });
  });

  it("counts transport bytes for the selected batch and rejects oversized pasted text", () => {
    const destination = { kind: "existing", deck_id: "general" } as const;
    const longCard = { question: "界".repeat(2000), answer: "界".repeat(2000) };
    expect(fitsFlashcardImportRequest({ destination, cards: Array(17).fill(longCard) })).toBe(true);
    expect(fitsFlashcardImportRequest({ destination, cards: Array(18).fill(longCard) })).toBe(false);
    expect(parseFlashcardImport(" ".repeat(512 * 1024 + 1)).issue).toEqual({ code: "size" });
  });
});
