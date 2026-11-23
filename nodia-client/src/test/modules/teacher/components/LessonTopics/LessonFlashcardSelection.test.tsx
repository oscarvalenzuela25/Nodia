import { fireEvent, render, screen, within } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { MemoryRouter } from "react-router";
import type { ComponentProps } from "react";
import { afterEach, expect, it, vi } from "vitest";
import LessonTopics from "../../../../../modules/teacher/components/LessonTopics";

vi.mock("../../../../../modules/teacher/components/AdaptiveWorkspace/BlockLearningTools", () => ({ default: () => null }));

const theme = createTheme();
const blocks = [
  { id: "greetings", title: "Saludos", body_markdown: "Say **Nice to meet you**." },
  { id: "farewells", title: "Despedidas", body_markdown: "Say **See you soon**." },
];
type LessonTopicsProps = ComponentProps<typeof LessonTopics>;

function view(onCreateFlashcard: LessonTopicsProps["onCreateFlashcard"], {
  finalActive = false, onSaveReadingPoint = vi.fn(), flashcardEditorOpen = false,
} = {}) {
  const session = {
    id: "fixture-session",
    active_attempts: finalActive ? [{ scope: "section_final", state: "in_progress" }] : [],
  } as LessonTopicsProps["session"];
  return <ThemeProvider theme={theme}>
    <MemoryRouter>
      <LessonTopics blocks={blocks} session={session} contentVersionId="fixture-version" busy={false}
        savedBlockId={null} onSaveReadingPoint={onSaveReadingPoint} command={{} as LessonTopicsProps["command"]}
        onResult={vi.fn()} onCreateFlashcard={onCreateFlashcard} flashcardEditorOpen={flashcardEditorOpen} />
    </MemoryRouter>
  </ThemeProvider>;
}

function selectText(start: HTMLElement, end = start) {
  const range = document.createRange();
  range.setStart(start.firstChild!, 0);
  range.setEnd(end.firstChild!, end.textContent!.length);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  fireEvent(document, new Event("selectionchange"));
}

const createFlashcard = () => screen.queryByRole("button", { name: "Crear flashcard" });

afterEach(() => window.getSelection()?.removeAllRanges());

it("opens the editor with the visible lesson provenance even if keyboard focus cleared the selection", () => {
  const openEditor = vi.fn();
  const saveCursor = vi.fn();
  render(view(openEditor, { onSaveReadingPoint: saveCursor }));
  expect(createFlashcard()).not.toBeInTheDocument();
  selectText(screen.getByText("Nice to meet you"));
  const trigger = within(screen.getByRole("region", { name: "Saludos" })).getByRole("button", { name: "Crear flashcard" });
  expect(trigger).toHaveAttribute("aria-haspopup", "dialog");

  trigger.focus();
  window.getSelection()!.removeAllRanges();
  fireEvent(document, new Event("selectionchange"));
  fireEvent.click(trigger, { detail: 0 });

  expect(openEditor).toHaveBeenCalledExactlyOnceWith({
    sessionId: "fixture-session", contentVersionId: "fixture-version", blockId: "greetings", quote: "Nice to meet you",
  });
  expect(saveCursor).not.toHaveBeenCalled();
});

it("keeps the exact selected quote when a touch press clears the browser selection before click", () => {
  const openEditor = vi.fn();
  render(view(openEditor));
  selectText(screen.getByText("See you soon"));
  const trigger = screen.getByRole("button", { name: "Crear flashcard" });

  fireEvent.pointerDown(trigger, { pointerType: "touch" });
  window.getSelection()!.removeAllRanges();
  fireEvent(document, new Event("selectionchange"));
  fireEvent.click(trigger, { detail: 1 });

  expect(openEditor).toHaveBeenCalledExactlyOnceWith({
    sessionId: "fixture-session", contentVersionId: "fixture-version", blockId: "farewells", quote: "See you soon",
  });
});

it("keeps the opener mounted when the editor changes the browser selection", () => {
  const openEditor = vi.fn();
  const { rerender } = render(view(openEditor));
  selectText(screen.getByText("Nice to meet you"));
  const trigger = createFlashcard();
  expect(trigger).toBeVisible();

  rerender(view(openEditor, { flashcardEditorOpen: true }));
  window.getSelection()!.removeAllRanges();
  fireEvent(document, new Event("selectionchange"));
  rerender(view(openEditor));

  expect(createFlashcard()).toBe(trigger);
});

it("exposes no flashcard action for cross-topic selections or during an active final", () => {
  const openEditor = vi.fn();
  const { rerender } = render(view(openEditor));
  const greeting = screen.getByText("Nice to meet you");
  selectText(greeting, screen.getByText("See you soon"));
  expect(createFlashcard()).not.toBeInTheDocument();

  rerender(view(openEditor, { finalActive: true }));
  selectText(greeting);
  expect(createFlashcard()).not.toBeInTheDocument();
  expect(openEditor).not.toHaveBeenCalled();
});
