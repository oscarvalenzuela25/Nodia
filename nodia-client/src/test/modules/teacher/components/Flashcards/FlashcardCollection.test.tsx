import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import {
  FlashcardCollectionDeck, FlashcardCollectionFace, FlashcardCollectionItems, FlashcardCollectionViewToggle,
} from "../../../../../modules/teacher/components/Flashcards/FlashcardCollection";

it("keeps the card openable when its image cannot decode and accepts a replacement URL", async () => {
  const user = userEvent.setup();
  const onOpen = vi.fn();
  const card = { identity: "card", question: "¿Dónde está la estación?", source: "Apuntes", hasImage: true, busy: false, onOpen };
  const { rerender } = render(<FlashcardCollectionFace {...card} mode="grid" imageSrc="blob:broken" />);
  const image = screen.getByAltText("");
  fireEvent.error(image);
  expect(image).not.toBeInTheDocument();
  expect(screen.getByText("Apuntes")).toBeVisible();
  await user.click(screen.getByRole("button", { name: /¿Dónde está la estación\?/ }));
  expect(onOpen).toHaveBeenCalledOnce();

  rerender(<FlashcardCollectionFace {...card} mode="list" imageSrc="blob:replacement" />);
  expect(screen.getByAltText("")).toHaveAttribute("src", "blob:replacement");
});

it.each(["grid", "list"] as const)("keeps choosing a deck separate from deleting it in %s view", async mode => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  const onDelete = vi.fn();
  const deck = { id: "deck", title: "Frases para viajar", card_count: 0, category: "Inglés" };
  render(<FlashcardCollectionItems mode={mode}>
    <FlashcardCollectionDeck deck={deck} mode={mode} busy={false} onSelect={onSelect} onDelete={onDelete} />
  </FlashcardCollectionItems>);
  const openButton = screen.getByRole("button", { name: /^(?!Eliminar).*Frases para viajar/ });
  expect(openButton).toHaveAccessibleName(/0 tarjetas/);
  await user.click(screen.getByRole("button", { name: /Eliminar.*Frases para viajar/ }));
  expect(onDelete).toHaveBeenCalledOnce();
  expect(onSelect).not.toHaveBeenCalled();
  await user.click(openButton);
  expect(onSelect).toHaveBeenCalledOnce();
});

it("keeps one view selected when its button is pressed again", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<FlashcardCollectionViewToggle value="grid" disabled={false} onChange={onChange} />);
  const grid = screen.getByRole("button", { name: "Cuadrícula" });
  expect(grid).toHaveAttribute("aria-pressed", "true");
  await user.click(grid);
  expect(onChange).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Lista" }));
  expect(onChange).toHaveBeenCalledWith("list");
});
