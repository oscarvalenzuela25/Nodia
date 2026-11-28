import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError } from "axios";
import { sileo } from "sileo";
import { expect, it, vi } from "vitest";
import FlashcardImportDrawer from "../../../../../modules/teacher/components/Flashcards/FlashcardImportDrawer";
import type { FlashcardImportBatch, FlashcardImportReceipt } from "../../../../../modules/teacher/infrastructure/flashcardImport";

const general = { id: "general", title: "General", card_count: 4, category: null };
const imported = { deck: { ...general, card_count: 5 }, imported_count: 1 };
const card = { question: "¿Qué significa stream?", answer: "Arroyo.", source: "Apuntes" };

it("reviews before writing, allows a selected subset and preserves it and the request key on uncertain retry", async () => {
  const user = userEvent.setup();
  const save = vi.fn<(batch: FlashcardImportBatch, requestKey: string) => Promise<FlashcardImportReceipt | null>>()
    .mockRejectedValueOnce(new AxiosError("Connection lost")).mockResolvedValueOnce(imported);
  const onImported = vi.fn();
  render(<FlashcardImportDrawer decks={[general]} busy={false} save={save} onClose={vi.fn()} onImported={onImported} />);
  const paste = screen.getByRole("textbox", { name: "Tarjetas en JSON" });
  expect(screen.getByRole("button", { name: "Revisar tarjetas" })).toBeDisabled();
  fireEvent.change(paste, { target: { value: JSON.stringify({
    version: 1, cards: [card, { question: "Otra pregunta", answer: "Otra respuesta" }],
  }) } });
  await user.click(screen.getByRole("button", { name: "Revisar tarjetas" }));

  expect(screen.getByRole("heading", { name: "Vista previa de tarjetas" })).toHaveFocus();
  expect(screen.getByText(card.answer)).toBeVisible();
  expect(screen.getByText("Fuente · Apuntes")).toBeVisible();
  expect(save).not.toHaveBeenCalled();
  await user.click(screen.getByRole("checkbox", { name: "Otra pregunta" }));
  await user.click(screen.getByRole("button", { name: "Guardar 1 tarjeta" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo confirmar");
  expect(onImported).not.toHaveBeenCalled();
  expect(screen.getByRole("checkbox", { name: "Otra pregunta" })).toBeDisabled();
  expect(save).toHaveBeenCalledWith({ destination: { kind: "existing", deck_id: "general" }, cards: [card] }, expect.any(String));
  await user.click(screen.getByRole("button", { name: /reintentar/i }));
  await waitFor(() => expect(onImported).toHaveBeenCalledWith(imported));
  expect(save.mock.calls[1]).toEqual(save.mock.calls[0]);
});

it("shows the new deck and its category, and requires a fresh preview after editing JSON", async () => {
  const user = userEvent.setup();
  const save = vi.fn();
  render(<FlashcardImportDrawer decks={[general]} busy={false} save={save} onClose={vi.fn()} onImported={vi.fn()} />);
  await user.click(screen.getByRole("button", { name: "Cargar ejemplo" }));
  await user.click(screen.getByRole("button", { name: "Revisar tarjetas" }));
  expect(screen.getByRole("textbox", { name: /Nombre del mazo/ })).toHaveValue("Inglés para viajar");
  expect(screen.getByRole("textbox", { name: "Categoría (opcional)" })).toHaveValue("Inglés");
  await user.click(screen.getByRole("button", { name: "Editar JSON" }));
  const paste = screen.getByRole("textbox", { name: "Tarjetas en JSON" });
  expect(paste).toHaveFocus();
  fireEvent.change(paste, { target: { value: "{broken" } });
  await user.click(screen.getByRole("button", { name: "Revisar tarjetas" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("JSON válido");
  expect(screen.queryByRole("button", { name: /Guardar \d+ tarjeta/ })).not.toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
});

it("confirms when the selected example is loaded into the JSON input", async () => {
  const user = userEvent.setup();
  const success = vi.spyOn(sileo, "success").mockReturnValue("example");
  const save = vi.fn();
  try {
    render(<FlashcardImportDrawer decks={[general]} busy={false} save={save} onClose={vi.fn()} onImported={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Cargar ejemplo" }));
    expect(screen.getByRole("textbox", { name: "Tarjetas en JSON" })).toHaveProperty("value", expect.stringContaining('"cards"'));
    expect(success).toHaveBeenCalledExactlyOnceWith({ title: "Ejemplo cargado" });
    expect(screen.getByRole("status")).toHaveTextContent("Ejemplo cargado");
    expect(save).not.toHaveBeenCalled();
  } finally {
    success.mockRestore();
  }
});

it("retains selection when navigating to another page of a batch", async () => {
  const user = userEvent.setup();
  const save = vi.fn().mockResolvedValue({ deck: { ...general, card_count: 10 }, imported_count: 6 });
  const cards = Array.from({ length: 7 }, (_, index) => ({ question: "Pregunta " + (index + 1), answer: "Respuesta" }));
  render(<FlashcardImportDrawer decks={[general]} busy={false} save={save} onClose={vi.fn()} onImported={vi.fn()} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Tarjetas en JSON" }), {
    target: { value: JSON.stringify({ version: 1, cards }) },
  });
  await user.click(screen.getByRole("button", { name: "Revisar tarjetas" }));
  await user.click(screen.getByRole("checkbox", { name: "Pregunta 1" }));
  await user.click(screen.getByRole("button", { name: "Página siguiente" }));
  expect(screen.getByRole("checkbox", { name: "Pregunta 7" })).toBeChecked();
  await user.click(screen.getByRole("button", { name: "Página anterior" }));
  expect(screen.getByRole("checkbox", { name: "Pregunta 1" })).not.toBeChecked();
  await user.click(screen.getByRole("button", { name: "Guardar 6 tarjetas" }));
  expect(save).toHaveBeenCalledWith({ destination: { kind: "existing", deck_id: "general" }, cards: cards.slice(1) }, expect.any(String));
});

it("copies distinct prompts for a deck and a single card", async () => {
  const user = userEvent.setup();
  const write = vi.spyOn(navigator.clipboard, "writeText");
  const success = vi.spyOn(sileo, "success").mockReturnValueOnce("deck").mockReturnValueOnce("card");
  render(<FlashcardImportDrawer decks={[general]} busy={false} save={vi.fn()} onClose={vi.fn()} onImported={vi.fn()} />);
  const copy = screen.getByRole("button", { name: "Copiar formato para IA" });
  await user.click(copy);
  await waitFor(() => expect(write).toHaveBeenCalledOnce());
  expect(write.mock.calls[0][0]).toContain('"deck":');
  expect(write.mock.calls[0][0]).toContain('"category":');
  await user.click(screen.getByRole("button", { name: "Una tarjeta" }));
  await user.click(copy);
  await waitFor(() => expect(write).toHaveBeenCalledTimes(2));
  expect(write.mock.calls[1][0]).toContain('"cards":');
  expect(write.mock.calls[1][0]).not.toContain('"deck":');
  expect(success.mock.calls).toEqual([[{ title: "Formato copiado" }], [{ title: "Formato copiado" }]]);
  expect(screen.getByRole("status")).toHaveTextContent("Formato copiado");
  write.mockRestore();
  success.mockRestore();
});

it("copies and loads the same set example and reviews its deck assignments before confirming", async () => {
  const user = userEvent.setup();
  const write = vi.spyOn(navigator.clipboard, "writeText");
  const receipt = { set: { id: "450e45c5-b22e-463a-abf3-fc13bac10fae", title: "Inglés práctico", deck_count: 1 }, imported_count: 1 };
  const save = vi.fn().mockResolvedValue(receipt);
  const onImported = vi.fn();
  try {
    render(<FlashcardImportDrawer decks={[general]} busy={false} save={save} onClose={vi.fn()} onImported={onImported} />);
    await user.click(screen.getByRole("button", { name: "Un set" }));
    await user.click(screen.getByRole("button", { name: "Copiar formato para IA" }));
    await user.click(screen.getByRole("button", { name: "Cargar ejemplo" }));
    const input = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Tarjetas en JSON" }).value;
    expect(write).toHaveBeenCalledWith(expect.stringContaining(input));

    await user.click(screen.getByRole("button", { name: "Revisar tarjetas" }));
    expect(screen.getByText("Nuevo set · Inglés práctico")).toBeVisible();
    expect(save).not.toHaveBeenCalled();
    await user.click(screen.getByRole("checkbox", { name: /Mazo · Inglés para viajar/ }));
    await user.click(screen.getByRole("button", { name: "Guardar 1 tarjeta" }));
    expect(save).toHaveBeenCalledWith({
      set: { title: "Inglés práctico" },
      decks: [{ title: "Orientación y transporte", cards: [{
        question: "¿Cómo pides indicaciones para llegar a la estación?",
        answer: "How do I get to the train station?",
      }] }],
    }, expect.any(String));
    expect(onImported).toHaveBeenCalledWith(receipt);
  } finally {
    write.mockRestore();
  }
});
