import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import StudyCalendarImportDrawer from "../../../../../modules/teacher/components/StudyCalendarImportDrawer";

const reviewLabel = "Revisar plan";
const confirmLabel = "Crear calendario";
const editorLabel = "Plan en JSON";
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
    await user.click(screen.getByRole("button", { name: reviewLabel }));
    expect(screen.getByText("Categorías que se crearán al confirmar")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vista previa" })).toHaveFocus();
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
    expect((screen.getByRole("textbox", { name: editorLabel }) as HTMLTextAreaElement).value).toContain("Inglés desde cero");
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
    await user.click(screen.getByRole("button", { name: reviewLabel }));
    await user.click(screen.getByRole("button", { name: confirmLabel }));
    const input = screen.getByRole<HTMLTextAreaElement>("textbox", { name: editorLabel });
    const submitted = input.value;

    rendered.rerender(view(true));
    expect(input).toHaveValue(submitted);
    expect(input).toBeDisabled();
    expect(screen.getByRole("button", { name: confirmLabel })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Reintentar creación" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
