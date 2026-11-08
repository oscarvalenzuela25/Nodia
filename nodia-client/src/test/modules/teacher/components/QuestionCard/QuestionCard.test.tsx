import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import QuestionCard from "../../../../../modules/teacher/components/QuestionCard";
import type { Question } from "../../../../../modules/teacher/infrastructure/schemas";

const question: Question = { question_id: "q1", kind: "single_choice", prompt: "Which service resolves a name?", options: [{ id: "a", label: "DNS" }, { id: "b", label: "SMTP" }], response_id: "r1", response_revision: 1, draft_answer: null, feedback: { correct_answer: "DNS", explanation: "DNS maps names to addresses.", earned_points: 2, max_points: 2 } };
describe("Teacher question boundary", () => {
  it("reports another tab's conflict to its pause boundary and keeps local text until explicit review/save", async () => {
    const onConflictChange = vi.fn();
    const onSave = vi.fn(async () => 3);
    const short: Question = { ...question, kind: "short_text", options: undefined, feedback: null };
    const props = { busy: false, canSave: true, canSubmit: false, final: true, delivered: false, onDraft: vi.fn(), onConflictChange, onSave, onSubmit: vi.fn() };
    const { rerender } = render(<QuestionCard {...props} question={short} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Tu respuesta" }), { target: { value: "local text" } });
    rerender(<QuestionCard {...props} question={{ ...short, response_revision: 2, draft_answer: { kind: "short_text", text: "other tab" } }} />);
    expect(onConflictChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole("textbox", { name: "Tu respuesta" })).toHaveValue("local text");
    expect(screen.getByText(/Otra revisión cambió la respuesta guardada: other tab/)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole("button", { name: "Guardar borrador" }));
    expect(onSave).toHaveBeenCalledWith({ kind: "short_text", text: "local text" }, 2);
    expect(onConflictChange).toHaveBeenLastCalledWith(false);
  });
  it("keeps the text input node, focus and caret after an autosave ACK/refetch", async () => {
    vi.useFakeTimers();
    try {
      let resolveSave: (value: number) => void = () => {};
      const onSave = vi.fn(() => new Promise<number>(resolve => { resolveSave = resolve; }));
      const onDraft = vi.fn();
      const short: Question = { ...question, kind: "short_text", options: undefined, feedback: null };
      const props = { canSave: true, canSubmit: false, final: true, delivered: false, onDraft, onSave, onSubmit: vi.fn() };
      const { rerender } = render(<QuestionCard {...props} question={short} busy={false} />);
      const input = screen.getByRole("textbox", { name: "Tu respuesta" }) as HTMLTextAreaElement;
      input.focus();
      fireEvent.change(input, { target: { value: "DNS answer" } });
      input.setSelectionRange(3, 3);
      await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
      expect(onSave).toHaveBeenCalledWith({ kind: "short_text", text: "DNS answer" }, 1);
      rerender(<QuestionCard {...props} question={short} busy />);
      rerender(<QuestionCard {...props} question={{ ...short, response_revision: 2, draft_answer: { kind: "short_text", text: "DNS answer" } }} busy={false} />);
      await act(async () => { resolveSave(2); await vi.advanceTimersByTimeAsync(20); });
      expect(screen.getByRole("textbox", { name: "Tu respuesta" })).toBe(input);
      expect(input).toHaveFocus();
      expect(input.selectionStart).toBe(3);
      expect(input.selectionEnd).toBe(3);
      expect(screen.getByText("Borrador guardado")).toBeInTheDocument();
      await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
      expect(onSave).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });
  it("never renders a final correction before full delivery even if supplied by a bad response", () => {
    render(<QuestionCard question={question} busy={false} canSave canSubmit final delivered={false} onDraft={vi.fn()} onSave={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.queryByText("DNS maps names to addresses.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar respuesta" })).not.toBeInTheDocument();
    expect(screen.getByText(/Las correcciones se muestran después/)).toBeInTheDocument();
  });
  it("saves a draft separately and retains the chosen answer until confirmed revision", async () => {
    const save = vi.fn(async () => null);
    const draft = vi.fn();
    render(<QuestionCard question={{ ...question, feedback: null }} busy={false} canSave canSubmit final={false} delivered={false} onDraft={draft} onSave={save} onSubmit={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: "SMTP" }));
    expect(draft).toHaveBeenCalledWith({ kind: "single_choice", option_id: "b" });
    expect(save).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Guardar borrador" }));
    expect(save).toHaveBeenCalledWith({ kind: "single_choice", option_id: "b" }, 1);
    expect(screen.getByRole("radio", { name: "SMTP" })).toBeChecked();
    expect(screen.getByText(/No se confirmó el guardado. Tu borrador se conserva/)).toBeInTheDocument();
  });
  it("reveals solution and explanation after delivery and disables the frozen answer", () => {
    render(<QuestionCard question={{ ...question, frozen_answer: { kind: "single_choice", option_id: "b" } }} busy={false} canSave={false} canSubmit={false} final delivered onDraft={vi.fn()} onSave={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByText("DNS maps names to addresses.")).toBeInTheDocument();
    expect(screen.getByText("Respuesta correcta: DNS")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "SMTP" })).toBeDisabled();
    expect(screen.getByText("Respuesta enviada")).toBeInTheDocument();
  });
  it("distinguishes an explicit I don't know from an untouched answer", async () => {
    const draft = vi.fn();
    render(<QuestionCard question={{ ...question, feedback: null }} busy={false} canSave canSubmit final delivered={false} onDraft={draft} onSave={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Guardar borrador" })).toBeDisabled();
    await userEvent.setup().click(screen.getByRole("radio", { name: "No lo sé" }));
    expect(draft).toHaveBeenCalledWith({ kind: "dont_know" });
    expect(screen.getByRole("button", { name: "Guardar borrador" })).toBeEnabled();
  });
});
