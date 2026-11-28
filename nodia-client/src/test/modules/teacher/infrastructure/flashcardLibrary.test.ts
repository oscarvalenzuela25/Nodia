import { describe, expect, it } from "vitest";
import { filterFlashcardLibrary, flashcardDeckPage } from "../../../../modules/teacher/infrastructure/flashcardLibrary";
import { flashcardDecksSchema, flashcardSetsSchema, type FlashcardDeck } from "../../../../modules/teacher/infrastructure/flashcards";

const setId = "119612ee-31b7-439b-8dfa-3482db6ab529";
const otherSet = "119612ee-31b7-439b-8dfa-3482db6ab530";
const deckId = "119612ee-31b7-439b-8dfa-3482db6ab531";
const sets = [{ id: setId, title: "Inglés", deck_count: 31 }, { id: otherSet, title: "Otro set", deck_count: 0 }];
const general = { id: "general", title: "General", card_count: 2 };
const history = { id: deckId, title: "Mazo anterior", card_count: 1, category: "Vocabulario" };
const decks = Array.from({ length: 31 }, (_, index): FlashcardDeck => ({
  id: "day-" + index, set_id: setId, title: "Día " + (index + 1), card_count: index, category: index < 30 ? "Vocabulario" : "Gramática",
}));

describe("flashcard library filters and paging", () => {
  it("keeps General available and combines Set and category when paging decks", () => {
    const result = filterFlashcardLibrary([general, history, ...decks], sets, setId, "vocabulario");
    expect(result.general).toEqual(general);
    expect(result.sets.map(set => set.id)).toEqual([setId]);
    expect(result.decks.map(deck => deck.id)).toEqual(decks.slice(0, 30).map(deck => deck.id));
    expect(flashcardDeckPage(result.bySet.get(setId) ?? [], 2)).toEqual({ page: 1, data: decks.slice(0, 30) });
  });

  it("clamps the last page after deletion and never presents a historical orphan as a root deck", () => {
    expect(flashcardDeckPage(decks, 2)).toEqual({ page: 2, data: [decks[30]] });
    expect(flashcardDeckPage(decks.slice(0, -1), 2).page).toBe(1);
    const result = filterFlashcardLibrary([general, history, ...decks], sets, "", "");
    expect(result.decks).toEqual(decks);
    expect(result.bySet.get(setId)).toEqual(decks);
    expect(flashcardDecksSchema.parse([general, history])).toEqual([general, history]);
    expect(flashcardSetsSchema.safeParse([{ ...sets[0], deck_count: null }]).success).toBe(false);
  });

  it("retains parent IDs in the grouping when the Set catalog is unavailable", () => {
    const result = filterFlashcardLibrary([general, history, ...decks], [], "", "");
    expect(result.sets).toEqual([]);
    expect([...result.bySet]).toEqual([[setId, decks]]);
    expect(result.general).toEqual(general);
  });
});
