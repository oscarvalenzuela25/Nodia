import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { FlashcardDeckTree } from "../../../../../modules/teacher/components/Flashcards/FlashcardDeckTree";
import type { FlashcardDeck, FlashcardSet } from "../../../../../modules/teacher/infrastructure/flashcards";
import i18n from "../../../../../translate";

const studySet: FlashcardSet = { id: "set", title: "Inglés en 30 días", deck_count: 12 };
const general: FlashcardDeck = { id: "general", title: "General", card_count: 1 };
const loose: FlashcardDeck = { id: "loose", title: "Viajes", category: "Vocabulario", card_count: 0 };
const groups = Array.from({ length: studySet.deck_count }, (_, index): FlashcardDeck => ({
  id: "deck-" + (index + 1),
  title: "Día " + String(index + 1).padStart(2, "0"),
  set_id: studySet.id,
  card_count: 0,
}));
const sets = [studySet];
const decks = [...groups, loose];
const categoryOptions = new Map([["vocabulario", "Vocabulario"]]);
const noop = () => {};

function TreeProbe({ onSelectDeck = noop, onDeleteDeck = noop, setsUnavailable = false }: {
  onSelectDeck?: (deck: FlashcardDeck) => void;
  onDeleteDeck?: (deck: FlashcardDeck) => void;
  setsUnavailable?: boolean;
}) {
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(true);
  const availableSets = setsUnavailable ? [] : sets;
  return <FlashcardDeckTree sets={availableSets} decks={decks} generalDeck={general} setOptions={availableSets} categoryOptions={categoryOptions}
    setFilter="" categoryFilter="" expandedSetIds={new Set(open ? [studySet.id] : [])} pages={new Map([[studySet.id, page]])}
    busy={false} setsUnavailable={setsUnavailable} onSetFilter={noop} onCategoryFilter={noop} onToggleSet={() => setOpen(value => !value)} onSelectSet={noop}
    onSelectDeck={onSelectDeck} onPageChange={(_, value) => setPage(value)} onDeleteSet={noop} onDeleteDeck={onDeleteDeck} />;
}

it("shows ten decks per branch, keeps General available, and handles delete separately from selection", async () => {
  const user = userEvent.setup();
  const selectDeck = vi.fn();
  const deleteDeck = vi.fn();
  render(<TreeProbe onSelectDeck={selectDeck} onDeleteDeck={deleteDeck} />);
  expect(screen.getByText("Día 10")).toBeVisible();
  expect(screen.queryByText("Día 11")).not.toBeInTheDocument();
  expect(screen.getByText("Viajes")).toBeVisible();
  const generalRow = screen.getByText(i18n.t("teacher:flashcards.general")).closest("li");
  expect(generalRow).not.toBeNull();
  expect(within(generalRow!).getAllByRole("button")).toHaveLength(1);

  await user.click(screen.getByRole("button", { name: i18n.t("teacher:flashcard_sets.next_decks") }));
  expect(screen.getByText("Día 11")).toBeVisible();
  expect(screen.queryByText("Día 10")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: i18n.t("teacher:flashcard_sets.next_decks") })).toBeDisabled();
  const deckRow = within(screen.getByText("Día 11").closest("li")!);
  await user.click(deckRow.getByRole("button", { name: i18n.t("teacher:flashcard_sets.delete_deck_label", { title: "Día 11" }) }));
  expect(deleteDeck).toHaveBeenCalledWith(groups[10]);
  expect(selectDeck).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: i18n.t("teacher:flashcard_sets.collapse", { title: studySet.title }) }));
  expect(screen.queryByText("Día 11")).not.toBeInTheDocument();
});

it("keeps known decks navigable while Set metadata is unavailable", async () => {
  const user = userEvent.setup();
  const selectDeck = vi.fn();
  render(<TreeProbe onSelectDeck={selectDeck} setsUnavailable />);
  expect(screen.getByRole("button", { name: i18n.t("teacher:flashcard_sets.set_filter") })).toHaveAttribute("aria-disabled", "true");
  expect(screen.getByRole("button", { name: i18n.t("teacher:flashcard_sets.category_filter") })).toHaveAttribute("aria-disabled", "false");
  expect(screen.queryByText(i18n.t("teacher:flashcard_sets.loose_decks"))).not.toBeInTheDocument();
  await user.click(screen.getByText("Día 11"));
  expect(selectDeck).toHaveBeenCalledWith(groups[10]);
});

it("closes the mobile explorer after browsing a deck and restores the toggle's focus", async () => {
  const user = userEvent.setup();
  const selectDeck = vi.fn();
  const media = vi.spyOn(window, "matchMedia").mockImplementation(query => ({
    matches: query.includes("max-width"), media: query, onchange: null, addListener: noop, removeListener: noop,
    addEventListener: noop, removeEventListener: noop, dispatchEvent: () => false,
  }));
  try {
    render(<TreeProbe onSelectDeck={selectDeck} />);
    const toggle = screen.getByRole("button", { name: i18n.t("teacher:flashcard_sets.tree") });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByText("Día 01"));
    expect(selectDeck).toHaveBeenCalledWith(groups[0]);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus();
  } finally {
    media.mockRestore();
  }
});
