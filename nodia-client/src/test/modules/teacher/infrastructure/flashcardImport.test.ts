import { describe, expect, it } from "vitest";
import { fitsFlashcardImportRequest, parseFlashcardImport, selectedFlashcardSetDecks } from "../../../../modules/teacher/infrastructure/flashcardImport";

const card = { question: " ¿Qué significa hill? ", answer: " Colina. ", source: " Vocabulario " };

describe("flashcard import format", () => {
  it("reads one card and a fenced deck, normalizing human text", () => {
    const single = parseFlashcardImport(JSON.stringify({ version: 1, cards: [card] }));
    expect(single.plan).toEqual({ version: 1, cards: [{ question: "¿Qué significa hill?", answer: "Colina.", source: "Vocabulario" }] });
    const json = JSON.stringify({ version: 1, deck: { title: "  Ｉnglés   diario ", category: " Idiomas " }, cards: [card] });
    const fence = String.fromCharCode(96).repeat(3);
    expect(parseFlashcardImport(fence + "json\n" + json + "\n" + fence).plan)
      .toMatchObject({ deck: { title: "Inglés diario", category: "Idiomas" } });
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

  it("preserves card assignments when selecting a subset across deck boundaries", () => {
    const next = { question: "Next?", answer: "Yes." };
    const last = { question: "Last?", answer: "Yes." };
    const { plan } = parseFlashcardImport(JSON.stringify({
      version: 1, set: { title: " Ｉnglés " },
      decks: [
        { title: "Primero", cards: [card] },
        { title: "Segundo", category: " Viajes ", cards: [next, last] },
      ],
    }));
    if (!plan || !("decks" in plan)) throw new Error("Expected a set");
    expect(plan.set.title).toBe("Inglés");
    expect(selectedFlashcardSetDecks(plan.decks, [false, false, true])).toEqual([
      { title: "Segundo", category: "Viajes", cards: [last] },
    ]);
  });

  it("rejects duplicate normalized deck names, a large total, and malformed nested cards", () => {
    const parse = (decks: unknown[]) => parseFlashcardImport(JSON.stringify({
      version: 1, set: { title: "Set" }, decks,
    })).issue;
    const deck = { title: "Uno", cards: [card] };
    expect(parse([deck, { ...deck, title: " ＵＮＯ " }])).toEqual({ code: "duplicate_decks" });
    expect(parse([{ ...deck, cards: Array(30).fill(card) }, { ...deck, title: "Dos" }]))
      .toEqual({ code: "set_count" });
    expect(parse([deck, { title: "Dos", cards: [{ ...card, answer: "" }] }]))
      .toEqual({ code: "set_card", deckIndex: 2, index: 1 });
  });
});
