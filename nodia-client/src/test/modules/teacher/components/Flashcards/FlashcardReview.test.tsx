import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import FlashcardReview from "../../../../../modules/teacher/components/Flashcards/FlashcardReview";
import type { Flashcard } from "../../../../../modules/teacher/infrastructure/flashcards";

const { query, image } = vi.hoisted(() => ({ query: vi.fn(), image: vi.fn() }));
vi.mock("../../../../../modules/teacher/infrastructure/flashcards", async importOriginal => ({
  ...await importOriginal<typeof import("../../../../../modules/teacher/infrastructure/flashcards")>(), flashcardPageSize: 1,
}));
vi.mock("../../../../../modules/teacher/infrastructure/useFlashcards", () => ({
  useFlashcards: query, useFlashcardImage: image,
}));

const cards: Flashcard[] = [
  { id: "first", deck_id: "general", question: "¿Saludos?", answer: "Hola", source: null, revision: 1, image: { side: "answer" } },
  { id: "second", deck_id: "general", question: "¿Despedidas?", answer: "Adiós", source: null, revision: 1, image: null },
];

it("reveals the answer and its image together, retries the same mark, and finishes at a page boundary", async () => {
  const user = userEvent.setup();
  query.mockImplementation((_id: string, page: number, enabled: boolean) => ({
    data: enabled && cards[page - 1] ? { data: [cards[page - 1]], meta: { page, total: cards.length, total_pages: cards.length } } : undefined,
    isFetching: false, isError: false,
  }));
  image.mockImplementation((card: Flashcard, enabled: boolean) => ({
    src: enabled && card.image ? "data:image/webp;base64,b2xk" : null, isError: false, isLoading: false,
  }));
  const rate = vi.fn<(id: string, remembered: boolean, key: string) => Promise<boolean>>()
    .mockRejectedValueOnce(new Error("network")).mockResolvedValue(true);

  render(<FlashcardReview deckId="general" decks={[{ id: "general", title: "General", card_count: cards.length }]}
    active busy={false} rateCard={rate} onSelectDeck={vi.fn()} onClose={vi.fn()} />);
  expect(screen.getByRole("heading", { name: "¿Saludos?" })).toHaveFocus();
  expect(screen.queryByText("Hola")).not.toBeInTheDocument();
  expect(image.mock.calls.at(-1)).toEqual([cards[0], false]);
  await user.click(screen.getByRole("button", { name: "Mostrar respuesta" }));
  expect(screen.getByText("Hola")).toBeVisible();
  expect(image.mock.calls.at(-1)).toEqual([cards[0], true]);
  await user.click(screen.getByRole("button", { name: "Repasar de nuevo" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo confirmar la marca");
  expect(screen.getByText("Hola")).toBeVisible();
  await user.click(screen.getByRole("button", { name: /reintentar/i }));
  expect(await screen.findByRole("heading", { name: "¿Despedidas?" })).toHaveFocus();
  expect(rate.mock.calls[0]).toEqual(rate.mock.calls[1]);
  await user.click(screen.getByRole("button", { name: "Mostrar respuesta" }));
  await user.click(screen.getByRole("button", { name: "La recordé" }));
  expect(await screen.findByRole("heading", { name: "Repaso terminado" })).toBeVisible();
  expect(screen.getByText("Recordadas 1 · Para repasar 1")).toBeVisible();
  expect(query.mock.calls).not.toContainEqual(["general", 3, true]);
  await user.click(screen.getByRole("button", { name: "Repasar de nuevo" }));
  await waitFor(() => expect(screen.getByRole("heading", { name: "¿Saludos?" })).toHaveFocus());
});
