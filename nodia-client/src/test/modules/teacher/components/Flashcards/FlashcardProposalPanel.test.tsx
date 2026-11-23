import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import FlashcardEditor from "../../../../../modules/teacher/components/Flashcards/FlashcardEditor";
import type { FlashcardLibraryRequest } from "../../../../../modules/teacher/components/Flashcards/FlashcardProposalPanel";
import type { Flashcard, FlashcardDraft, FlashcardSide } from "../../../../../modules/teacher/infrastructure/flashcards";
import type { FlashcardProposalStatus } from "../../../../../modules/teacher/infrastructure/flashcardLibraryProposal";

const stub = vi.hoisted(() => ({
  actor: { user: { id: "7" }, sessionVersion: 4, sessionStatus: "authenticated", active: true },
  get: vi.fn(), post: vi.fn(), notice: vi.fn(), prepare: vi.fn(),
}));
vi.mock("../../../../../store/authStore", () => ({
  default: Object.assign(<T,>(selector: (state: typeof stub.actor) => T) => selector(stub.actor), { getState: () => stub.actor }),
  hasActiveSession: (actor: typeof stub.actor) => actor.active,
}));
vi.mock("../../../../../config/api", () => ({ mainInstance: { get: stub.get, post: stub.post } }));
vi.mock("../../../../../config/httpFeedback", () => ({ notifyHttpError: stub.notice }));
vi.mock("sileo", () => ({ sileo: { success: stub.notice } }));
vi.mock("../../../../../modules/teacher/infrastructure/flashcardImage", () => ({
  flashcardImageAccept: "image/png", prepareFlashcardImage: stub.prepare,
}));

const id = "1be370ad-8fed-4db8-b51c-6716f3b128ab";
const card: Flashcard = {
  id: "ea907ff0-e212-477f-9129-c8ac0d618eda",
  deck_id: "general", question: "Pregunta guardada", answer: "Respuesta guardada", revision: 3, image: null, source: null,
};
const textValue = { question: "Pregunta propuesta", answer: "Respuesta propuesta" };
const path = "/teacher/flashcards/proposals";
const preparedImage = { data: "AABB", blob: new Blob(["webp"], { type: "image/webp" }) };
const proposalImage = new Blob(["generated"], { type: "image/png" });
const anchor = {
  session_id: "2896f83e-a89a-4c21-a751-b6f496d03f49",
  content_version_id: "28162b9b-87d7-4ffe-b4d2-ca4a8cbb32d0",
  block_id: "tema", selection: "Una variable tiene un nombre.",
};
const source = { label: "Una lección", anchor };
const pick = { connection_id: "12", mode: "api_key", effort_id: null } as const;
const catalog = { items: [{
  connection_id: "12", label: "Conexión de prueba", is_active: true, is_default: false, default_mode: "api_key",
  modes: [{ mode: "api_key", configured_selection: null, configuration: "configured",
    models: [{ model_id: "fixture-text", label: "Modelo de texto", efforts: [] },
      { model_id: "fixture-image", label: "Modelo de imagen", efforts: [] }],
  }],
}], next_cursor: null };
let serverStatus: FlashcardProposalStatus;

function editor(libraryRequest: FlashcardLibraryRequest, options?: { card?: Flashcard; initialValues?: FlashcardDraft }) {
  const save = vi.fn<(draft: FlashcardDraft, side: FlashcardSide) => Promise<boolean>>(async () => true);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}>
    <FlashcardEditor decks={[{ id: "general", title: "General", card_count: 1 }]} mode={options?.card ? "edit" : "create"}
      {...options} libraryRequest={libraryRequest} onSave={save} onClose={vi.fn()} />
  </QueryClientProvider>);
  return { save, user: userEvent.setup() };
}

async function choosePart(user: ReturnType<typeof userEvent.setup>, part: "Texto" | "Imagen") {
  const group = within(screen.getByRole("group", { name: part }));
  await user.click(group.getByRole("button", { name: "Conexión" }));
  await user.click(await screen.findByRole("option", { name: "Conexión de prueba" }));
  await user.click(group.getByRole("button", { name: "Modelo" }));
  await user.click(await screen.findByRole("option", { name: part === "Texto" ? "Modelo de texto" : "Modelo de imagen" }));
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL = vi.fn(() => "blob:preview");
    static revokeObjectURL = vi.fn();
  });
  serverStatus = {
    id, text: { state: "ready", error_code: null, value: textValue }, image: { state: "ready", error_code: null },
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  };
  stub.get.mockImplementation(async (url: string, opts: { params?: Record<string, string> }) => {
    if (url === "/teacher/connections") return { data: catalog };
    if (url === path + "/eligibility") return { data: {
      eligible: true, reason_code: null, selection: { ...pick, model_id: opts.params?.model_id },
    } };
    if (url.endsWith("/image")) return { data: proposalImage };
    return { data: serverStatus };
  });
  stub.post.mockResolvedValue({ status: 202, data: { id } });
  stub.prepare.mockResolvedValue(preparedImage);
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("requires meaningful notes and preview approval independently for text and image", async () => {
  const { save, user } = editor({ origin: { kind: "notes" } });
  await screen.findByRole("group", { name: "Texto" });
  await choosePart(user, "Texto");
  await choosePart(user, "Imagen");
  await waitFor(() => expect(stub.get.mock.calls.filter(([url]) => url === path + "/eligibility")).toHaveLength(2));
  const generate = screen.getByRole("button", { name: "Generar propuesta" });
  const notes = screen.getByRole("textbox", { name: /^Apuntes/ });
  await user.type(notes, "   ");
  expect(generate).toBeDisabled();
  expect(stub.post).not.toHaveBeenCalled();

  await user.type(notes, "Una clase sobre variables ");
  await waitFor(() => expect(generate).toBeEnabled());
  await user.click(generate);
  expect(stub.post).toHaveBeenCalledExactlyOnceWith(path, {
    parts: "both", origin: { kind: "notes", notes: "Una clase sobre variables" }, request_key: expect.any(String),
    text_selection: { ...pick, model_id: "fixture-text" }, image_selection: { ...pick, model_id: "fixture-image" },
  });
  expect(await screen.findByRole("heading", { name: "Vista previa de la propuesta" })).toBeVisible();
  expect(await screen.findByRole("img", { name: "Vista previa de la imagen generada" })).toHaveAttribute("src", "blob:preview");
  const question = screen.getByRole("textbox", { name: /^Pregunta/ });
  expect(question).toHaveValue("");
  expect(stub.prepare).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();

  await user.click(screen.getByRole("button", { name: "Usar propuesta de texto" }));
  await user.click(screen.getByRole("button", { name: "Usar propuesta de imagen" }));
  expect(question).toHaveValue(textValue.question);
  expect(stub.prepare).toHaveBeenCalledOnce();
  expect(save).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Guardar tarjeta" }));
  await waitFor(() => expect(save).toHaveBeenCalledExactlyOnceWith({
    ...textValue, deck_id: "general", image: { data: preparedImage.data, side: "answer" }, source: null,
  }, "answer"));
});

it("preserves the authenticated quote and applies available text when image generation fails", async () => {
  serverStatus.image = { state: "failed", error_code: null };
  const { save, user } = editor({ origin: { kind: "quote", anchor } },
    { initialValues: { question: "", answer: anchor.selection, source } });
  await screen.findByRole("group", { name: "Texto" });
  await choosePart(user, "Texto");
  await choosePart(user, "Imagen");
  const generate = screen.getByRole("button", { name: "Generar propuesta" });
  await waitFor(() => expect(generate).toBeEnabled());
  await user.click(generate);
  expect(await screen.findByText(/No se pudo generar esta parte.*Imagen/)).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Usar propuesta de texto" }));
  await user.click(screen.getByRole("button", { name: "Guardar tarjeta" }));
  await waitFor(() => expect(save).toHaveBeenCalledExactlyOnceWith({ ...textValue, deck_id: "general", source }, "answer"));
  expect(stub.get.mock.calls.some(([url]) => String(url).endsWith("/image"))).toBe(false);
});

it("reconciles an uncertain regeneration by receipt GET and preserves the stored text", async () => {
  serverStatus.text = { state: "skipped", error_code: null, value: null };
  stub.post.mockRejectedValueOnce(new Error("response lost"));
  const { save, user } = editor({ origin: { kind: "card", id: card.id, revision: card.revision }, initialParts: "image" }, { card });
  await screen.findByRole("group", { name: "Imagen" });
  await choosePart(user, "Imagen");
  const generate = screen.getByRole("button", { name: "Generar propuesta" });
  await waitFor(() => expect(generate).toBeEnabled());
  await user.click(generate);
  await user.click(await screen.findByRole("button", { name: "Consultar estado" }));
  expect(stub.post).toHaveBeenCalledOnce();
  const body = stub.post.mock.calls[0][1];
  expect(body).toMatchObject({ origin: { kind: "card", id: card.id, revision: 3 }, parts: "image" });
  expect(stub.get).toHaveBeenCalledWith(path + "/requests/" + body.request_key, expect.any(Object));
  await user.click(await screen.findByRole("button", { name: "Usar propuesta de imagen" }));
  expect(screen.getByRole("textbox", { name: /^Pregunta/ })).toHaveValue(card.question);
  expect(save).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => expect(save).toHaveBeenCalledExactlyOnceWith({
    question: card.question, answer: card.answer, deck_id: "general",
    image: { data: preparedImage.data, side: "answer" },
  }, "answer"));
});

it("requires a qualified image selection", async () => {
  const transport = stub.get.getMockImplementation();
  stub.get.mockImplementation(async (...args: Parameters<NonNullable<typeof transport>>) => {
    const response = await transport?.(...args);
    if (args[0] === path + "/eligibility" && args[1].params.kind === "image")
      return { data: { ...response.data, eligible: false, reason_code: "flashcard_image_unqualified" } };
    return response;
  });
  const { user } = editor({ origin: { kind: "card", id: card.id, revision: 3 }, initialParts: "image" }, { card });
  await screen.findByRole("group", { name: "Imagen" });
  await choosePart(user, "Imagen");
  expect(await screen.findByText(/requiere una verificación de generación de imágenes/)).toBeVisible();
  expect(screen.getByRole("button", { name: "Generar propuesta" })).toBeDisabled();
  expect(stub.post).not.toHaveBeenCalled();
});
