import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import FlashcardEditor from "../../../../../modules/teacher/components/Flashcards/FlashcardEditor";
import type { FlashcardTextRequest } from "../../../../../modules/teacher/components/Flashcards/FlashcardTextGeneration";
import type { Flashcard, FlashcardDraft, FlashcardSide } from "../../../../../modules/teacher/infrastructure/flashcards";

const stub = vi.hoisted(() => ({
  actor: { user: { id: "7" }, sessionVersion: 4, sessionStatus: "authenticated", active: true },
  get: vi.fn(), post: vi.fn(), success: vi.fn(), notify: vi.fn(),
}));
vi.mock("../../../../../store/authStore", () => ({
  default: Object.assign(<T,>(selector: (state: typeof stub.actor) => T) => selector(stub.actor), { getState: () => stub.actor }),
  hasActiveSession: (actor: typeof stub.actor) => actor.active,
}));
vi.mock("../../../../../config/api", () => ({ mainInstance: { get: stub.get, post: stub.post } }));
vi.mock("../../../../../config/httpFeedback", () => ({ notifyHttpError: stub.notify }));
vi.mock("sileo", () => ({ sileo: { success: stub.success } }));

const id = "1be370ad-8fed-4db8-b51c-6716f3b128ab";
const source = {
  label: "Una lección",
  anchor: {
    session_id: "2896f83e-a89a-4c21-a751-b6f496d03f49",
    content_version_id: "28162b9b-87d7-4ffe-b4d2-ca4a8cbb32d0",
    block_id: "tema",
    selection: "Una variable tiene un nombre.",
  },
};
const card: Flashcard = {
  id, deck_id: "general", question: "Pregunta guardada", answer: "Respuesta guardada", revision: 3, image: null, source,
};
const selection = { connection_id: "12", mode: "agentic", model_id: "fixture-model", effort_id: "fixture-effort" } as const;
const proposal = { question: "Pregunta propuesta", answer: "Respuesta propuesta" };
const ready = { id, state: "ready", error_code: null, proposal };
const generatedPath = "/teacher/flashcards/generations";

function editor(request: FlashcardTextRequest) {
  const save = vi.fn<(draft: FlashcardDraft, side: FlashcardSide) => Promise<boolean>>(async () => true);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}>
    <FlashcardEditor decks={[{ id: "general", title: "General", card_count: 1 }]} mode="edit" card={card}
      textRequest={request} onSave={save} onClose={vi.fn()} />
  </QueryClientProvider>);
  return { save, user: userEvent.setup() };
}

beforeEach(() => {
  vi.resetAllMocks();
  stub.get.mockImplementation(async (url: string) => ({
    data: url === "/teacher/connections"
      ? { items: [{ connection_id: "12", label: "Conexión del estudio", is_active: true, is_default: false, default_mode: null, modes: [] }], next_cursor: null }
      : ready,
  }));
});

it("reviews and applies regenerated text without touching the stored card until save", async () => {
  const target = { card_id: card.id, revision: card.revision, parts: "text" } as const;
  const { save, user } = editor({ target, selection });
  stub.post.mockResolvedValueOnce({ status: 202, data: { ...ready, state: "queued", proposal: null } });
  expect(await screen.findByText(/Conexión del estudio · Agentic · fixture-model · fixture-effort/)).toBeVisible();
  expect(stub.post).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Generar propuesta de texto" }));
  const apply = await screen.findByRole("button", { name: "Usar propuesta de texto" });
  expect(stub.post).toHaveBeenCalledExactlyOnceWith(generatedPath, { ...target, selection, request_key: expect.any(String) });
  const question = screen.getByRole("textbox", { name: /^Pregunta/ });
  expect(question).toHaveValue(card.question);
  expect(screen.getByText(proposal.question)).toBeVisible();
  expect(save).not.toHaveBeenCalled();

  await user.click(apply);
  expect(question).toHaveValue(proposal.question);
  expect(save).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => expect(save).toHaveBeenCalledExactlyOnceWith({ ...proposal, deck_id: "general" }, "answer"));
});

it("checks a lost generation acknowledgement by request key without a second POST", async () => {
  const { user, save } = editor({ target: { source: source.anchor }, selection });
  stub.post.mockRejectedValueOnce(new Error("response lost"));
  await screen.findByText(/Conexión del estudio/);
  await user.click(screen.getByRole("button", { name: "Generar propuesta de texto" }));
  const check = await screen.findByRole("button", { name: "Consultar estado" });
  await user.click(check);
  expect(await screen.findByRole("button", { name: "Usar propuesta de texto" })).toBeVisible();
  const key: unknown = stub.post.mock.calls[0]?.[1]?.request_key;
  expect(typeof key).toBe("string");
  expect(stub.get).toHaveBeenCalledWith(generatedPath + "/requests/" + key, expect.any(Object));
  expect(stub.post).toHaveBeenCalledOnce();
  expect(save).not.toHaveBeenCalled();
});
