import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import FlashcardEditor from "../../../../../modules/teacher/components/Flashcards/FlashcardEditor";
import FlashcardCreateDrawer from "../../../../../modules/teacher/components/Flashcards/FlashcardCreateDrawer";
import type { Flashcard, FlashcardDraft } from "../../../../../modules/teacher/infrastructure/flashcards";

const { prepare } = vi.hoisted(() => ({
  prepare: vi.fn<(file: File) => Promise<{ data: string; blob: Blob }>>(),
}));
vi.mock("../../../../../modules/teacher/infrastructure/flashcardImage", () => ({
  prepareFlashcardImage: prepare,
  flashcardImageAccept: "image/png",
}));
vi.mock("../../../../../modules/teacher/infrastructure/useFlashcards", () => ({
  useFlashcardImage: (card: Flashcard | undefined) => ({
    src: card?.image ? "data:image/webp;base64,b2xk" : null, isLoading: false, isError: false, refetch: vi.fn(),
  }),
}));

const decks = [{ id: "general", title: "General", card_count: 1 }];
const existing: Flashcard = {
  id: "existing", deck_id: "general", question: "¿Qué es una variable?", answer: "Un valor con nombre.",
  revision: 1, source: { label: "Introducción" }, image: { side: "answer" },
};

it("preserves the existing image after a bad upload and omits an unchanged source during edit", async () => {
  const user = userEvent.setup();
  const save = vi.fn(async () => false);
  prepare.mockRejectedValueOnce(new Error("unreadable"));
  render(<FlashcardEditor decks={decks} mode="edit" card={existing} onClose={vi.fn()} onSave={save} />);
  const question = screen.getByRole("textbox", { name: /^Pregunta/ });
  await user.type(question, " Da un ejemplo.");
  const fileInput = document.querySelector<HTMLInputElement>("input[type=file]");
  if (!fileInput) throw new Error("Image picker not rendered");
  fireEvent.change(fileInput, { target: { files: [new File(["invalid"], "bad.png", { type: "image/png" })] } });
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo preparar la imagen");
  expect(screen.getByRole("img", { name: "Vista previa de la imagen" })).toHaveAttribute("src", "data:image/webp;base64,b2xk");
  await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save).toHaveBeenCalledWith({
    question: "¿Qué es una variable? Da un ejemplo.", answer: existing.answer, deck_id: "general",
  }, "answer");
  expect(question).toHaveValue("¿Qué es una variable? Da un ejemplo.");
});

it("retries the frozen creation draft with the original request key after a missing acknowledgement", async () => {
  const user = userEvent.setup();
  const create = vi.fn<(draft: FlashcardDraft, key: string) => Promise<Flashcard | null>>()
    .mockRejectedValueOnce(new Error("connection lost")).mockResolvedValueOnce(existing);
  const onCreated = vi.fn();
  render(<FlashcardCreateDrawer decks={decks} initialValues={{ question: existing.question, answer: existing.answer }}
    createCard={create} onCreated={onCreated} onClose={vi.fn()} />);
  await user.click(screen.getByRole("button", { name: "Guardar tarjeta" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo confirmar el guardado");
  expect(screen.getByRole("textbox", { name: /^Pregunta/ })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: /reintentar/i }));
  await waitFor(() => expect(onCreated).toHaveBeenCalledWith(existing));
  expect(create.mock.calls).toHaveLength(2);
  expect(create.mock.calls[1]).toEqual(create.mock.calls[0]);
});
