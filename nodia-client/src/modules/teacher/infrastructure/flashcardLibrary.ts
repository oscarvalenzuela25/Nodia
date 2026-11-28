import { flashcardDeckPageSize, flashcardGeneralDeck, type FlashcardDeck, type FlashcardSet } from "./flashcards";

export const flashcardCategoryKey = (label?: string | null) => label?.normalize("NFKC").toLocaleLowerCase("es");

export function flashcardDeckPage(decks: readonly FlashcardDeck[], requestedPage = 1) {
  const page = Math.max(1, Math.min(requestedPage, Math.ceil(decks.length / flashcardDeckPageSize)));
  const first = (page - 1) * flashcardDeckPageSize;
  return { page, data: decks.slice(first, first + flashcardDeckPageSize) };
}

export function filterFlashcardLibrary(
  decks: readonly FlashcardDeck[],
  sets: readonly FlashcardSet[],
  setFilter: string,
  categoryFilter: string,
) {
  const categories = new Map<string, string>();
  const bySet = new Map<string, FlashcardDeck[]>();
  const visibleDecks: FlashcardDeck[] = [];
  const general = decks.find(deck => deck.id === flashcardGeneralDeck);
  for (const deck of decks) {
    const setId = deck.set_id;
    if (deck.id === flashcardGeneralDeck || !setId) continue;
    const category = flashcardCategoryKey(deck.category);
    if (category && deck.category && !categories.has(category)) categories.set(category, deck.category);
    if (categoryFilter && categoryFilter !== category) continue;
    if (setFilter && setFilter !== setId) continue;
    visibleDecks.push(deck);
    const children = bySet.get(setId) ?? [];
    children.push(deck);
    bySet.set(setId, children);
  }
  const visibleSets = sets.filter(set =>
    (!setFilter || setFilter === set.id) && (!categoryFilter || bySet.has(set.id) || setFilter === set.id));
  return { general, categories, decks: visibleDecks, sets: visibleSets, bySet };
}
