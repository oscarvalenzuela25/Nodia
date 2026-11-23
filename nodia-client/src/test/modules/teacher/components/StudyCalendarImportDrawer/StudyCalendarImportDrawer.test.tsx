import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import StudyCalendarImportDrawer from "../../../../../modules/teacher/components/StudyCalendarImportDrawer";

const reviewLabel = "Revisar plan";
const confirmLabel = "Crear calendario";
const editorLabel = "Plan en JSON";
const editLabel = "Editar JSON";
const open = true;
const onClose = vi.fn();

describe("study calendar import review", () => {
  it("keeps the pasted text and points focus to its error without offering confirmation", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<StudyCalendarImportDrawer open={open} onClose={onClose} categories={[]} isBusy={false} onConfirm={onConfirm} />);
    const input = screen.getByRole("textbox", { name: editorLabel });

    fireEvent.change(input, { target: { value: "{broken" } });
    await user.click(screen.getByRole("button", { name: reviewLabel }));

    expect(screen.getByRole("alert")).toHaveTextContent("El texto no es JSON válido");
    expect(input).toHaveValue("{broken");
    expect(input).toHaveFocus();
    expect(input).toHaveAccessibleDescription(/El texto no es JSON válido/);
    expect(screen.queryByRole("button", { name: confirmLabel })).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("requires fresh confirmation when the category classification changes", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const view = (categories: { name: string; active: boolean }[]) => (
      <StudyCalendarImportDrawer open={open} onClose={onClose} categories={categories} isBusy={false} onConfirm={onConfirm} />
    );
    const rendered = render(view([]));
    await user.click(screen.getByRole("button", { name: "Cargar ejemplo" }));
    const input = screen.getByRole<HTMLTextAreaElement>("textbox", { name: editorLabel });
    const draft = input.value.replace('"days": 2', '"days": 8');
    fireEvent.change(input, { target: { value: draft } });
    await user.click(screen.getByRole("button", { name: reviewLabel }));
    expect(screen.getByText("Categorías que se crearán al confirmar")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Inglés desde cero" })).toHaveFocus();
    expect(screen.getByText("8 jornadas · 1 en el plan pegado")).toBeInTheDocument();
    expect(screen.getByText("Clase 1 de Pacho8a")).toBeVisible();
    expect(screen.queryByRole("textbox", { name: editorLabel })).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();

    rendered.rerender(view([{ name: "Idiomas", active: false }]));
    expect(screen.getByRole("button", { name: confirmLabel })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: reviewLabel }));
    expect(screen.getByRole("alert")).toHaveTextContent(/categorías están inactivas.*Idiomas/);

    rendered.rerender(view([{ name: "Idiomas", active: true }]));
    expect(screen.getByRole("button", { name: confirmLabel })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: reviewLabel }));
    await user.click(screen.getByRole("button", { name: confirmLabel }));

    expect(onConfirm).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        categories: ["Idiomas"],
        schedule: { kind: "numbered", days: 8 },
        days: [expect.objectContaining({
          activities: [
            expect.objectContaining({ text: "Ver la lección", source: expect.objectContaining({ label: "Clase 1 de Pacho8a" }) }),
            expect.objectContaining({ text: "Completar seis frases", source: expect.objectContaining({ label: "Ejercicio To Be" }) }),
            { text: "Practicar en voz alta" },
          ],
        })],
      }),
      [],
    );

    await user.click(screen.getByRole("button", { name: editLabel }));
    expect(screen.getByRole("textbox", { name: editorLabel })).toHaveValue(draft);
    expect(screen.getByRole("textbox", { name: editorLabel })).toHaveFocus();
  });

  it("keeps the reviewed draft intact and offers recovery after an unconfirmed write", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onRetry = vi.fn();
    const view = (uncertain: boolean) => (
      <StudyCalendarImportDrawer open={open} onClose={onClose} categories={[]} isBusy={false}
        uncertain={uncertain} onRetry={onRetry} onConfirm={onConfirm} />
    );
    const rendered = render(view(false));
    await user.click(screen.getByRole("button", { name: "Cargar ejemplo" }));
    const submitted = screen.getByRole<HTMLTextAreaElement>("textbox", { name: editorLabel }).value;
    await user.click(screen.getByRole("button", { name: reviewLabel }));
    await user.click(screen.getByRole("button", { name: confirmLabel }));

    rendered.rerender(view(true));
    expect(screen.getByRole("heading", { name: "Inglés desde cero" })).toBeVisible();
    expect(screen.getByRole("button", { name: editLabel })).toBeDisabled();
    expect(screen.getByRole("button", { name: confirmLabel })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Reintentar creación" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);

    rendered.rerender(view(false));
    await user.click(screen.getByRole("button", { name: editLabel }));
    expect(screen.getByRole("textbox", { name: editorLabel })).toHaveValue(submitted);
  });

  it("offers the example and clipboard template after the text box without replacing a pasted draft when copying", async () => {
    const user = userEvent.setup();
    const writer = vi.spyOn(navigator.clipboard, "writeText");
    render(<StudyCalendarImportDrawer open={open} onClose={onClose} categories={[]} isBusy={false} onConfirm={vi.fn()} />);
    const input = screen.getByRole("textbox", { name: editorLabel });
    const example = screen.getByRole("button", { name: "Cargar ejemplo" });
    const copy = screen.getByRole("button", { name: "Copiar formato para agente" });
    fireEvent.change(input, { target: { value: "Mi borrador" } });
    input.focus();
    await user.tab();
    expect(example).toHaveFocus();
    await user.tab();
    expect(copy).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(writer).toHaveBeenCalledWith(expect.stringContaining('"version": 1'));
    expect(input).toHaveValue("Mi borrador");

    writer.mockRejectedValueOnce(new Error("Clipboard unavailable"));
    await user.click(copy);
    expect(await screen.findByText("Puedes seleccionar y copiar el formato manualmente.")).toBeVisible();
    expect(screen.getByLabelText("Copiar formato para agente", { selector: "pre" })).toHaveTextContent('"version": 1');
    expect(input).toHaveValue("Mi borrador");
    writer.mockRestore();
  });
});
