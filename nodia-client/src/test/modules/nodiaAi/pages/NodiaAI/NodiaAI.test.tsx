import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { defaultScheduler, notifyManager, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { AxiosError, AxiosHeaders } from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import { MemoryRouter, useNavigate } from "react-router";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NodiaAI from "../../../../../modules/nodiaAi/pages/NodiaAI";
import { mainInstance } from "../../../../../config/api";
import { notifyHttpError } from "../../../../../config/httpFeedback";
import useAuthStore from "../../../../../store/authStore";
import useGeneralSettingsStore from "../../../../../store/generalSettings/generalSettingsStore";
import type { NodiaAiConnection, NodiaAiDetail, NodiaAiMessagePage, NodiaAiSelection } from "../../../../../modules/nodiaAi/infrastructure/types";
import { chatId, conversation, detail, messageId, run, selection } from "../../infrastructure/fixtures";
import { acceptedEvent, observation, toolEvent } from "../../infrastructure/observationFixtures";
import { proposal, proposalEvent, readonlyReview, execution } from "../../infrastructure/proposalFixtures";
import type { NodiaAiEvent } from "../../../../../modules/nodiaAi/infrastructure/types";
import i18n from "../../../../../translate";
import { sileo } from "sileo";

vi.mock("sileo", () => ({sileo: {success: vi.fn(), error: vi.fn()}}));
const originalAdapter = mainInstance.defaults.adapter;
let client: QueryClient;
let current: NodiaAiDetail;
let other: NodiaAiDetail;
let navigate: ReturnType<typeof useNavigate>;
const otherChatId = "44444444-4444-4444-8444-444444444444";
let available: boolean;
let eligibilityReason: string;
let writes: {url: string; body: Record<string, unknown>}[];
let reads: {url: string; params: Record<string, unknown>}[];
let messageItems: unknown[];
let eventItems: NodiaAiEvent[];
let admitAction: ((config: InternalAxiosRequestConfig) => unknown) | undefined;
let patchAction: ((config: InternalAxiosRequestConfig) => unknown) | undefined;
const model = {model_id: selection.model_id, label: "Synthetic Agentic base model", efforts: []};
const agentic: NodiaAiSelection = {...selection, mode: "agentic", model_id: "synthetic-agentic-model"};
const routingTarget = {selection: agentic as NodiaAiSelection & {mode: "agentic"}, configuration_generation: "synthetic-config", session_generation: "synthetic-session"};
const catalog = {items: [{connection_id: selection.connection_id, label: "Synthetic connection", provider_key: "gemini", is_active: true, modes: [
  {mode: selection.mode, configured_selection: selection, models: [model, {...model, model_id: "synthetic-second-model", label: "Second Agentic model"}], configuration: "configured", authentication: "unknown", inference: "unknown", tools: "unsupported", observed_at: null, block_reason: null},
]}], next_cursor: null};

let extraConnections: NodiaAiConnection[] = [];
const codexSelection: NodiaAiSelection = { connection_id: "9007199254740995", mode: "agentic", model_id: "ai40-synthetic-codex", effort_id: "new-observed-effort" };
const codexConnection: NodiaAiConnection = { connection_id: codexSelection.connection_id, label: "AI40 synthetic Codex account", provider_key: "openai", is_active: true,
  modes: [{ mode: codexSelection.mode, configured_selection: codexSelection, models: [{ model_id: codexSelection.model_id, label: "AI40 discovered Codex model", efforts: [{ effort_id: "new-observed-effort", label: "New observed effort" }] }], configuration: "configured", authentication: "unknown", inference: "unknown", tools: "unknown", observed_at: null, block_reason: null }],
};
function response(config: InternalAxiosRequestConfig, data: unknown) { return {config, data, status: 200, statusText: "OK", headers: new AxiosHeaders()}; }
function rejected(config: InternalAxiosRequestConfig, status: number, message: string): never {
  throw new AxiosError(message, "ERR_BAD_REQUEST", config, undefined, {...response(config, {message}), status});
}
function accepted(config: InternalAxiosRequestConfig) {
  current = {...current, conversation: {...current.conversation, revision: current.conversation.revision + 1}, current_run: run};
  return response(config, {message_id: messageId, conversation_revision: current.conversation.revision, run});
}
function setupTransport() {
  mainInstance.defaults.adapter = async config => {
    const url = config.url ?? "";
    if (config.method === "post" || config.method === "patch") {
      const body: Record<string, unknown> = typeof config.data === "string" ? JSON.parse(config.data) as Record<string, unknown> : {};
      writes.push({url, body});
      if (config.method === "post" && url.endsWith("/messages")) return admitAction ? admitAction(config) as ReturnType<typeof response> : accepted(config);
      if (config.method === "patch") return patchAction ? patchAction(config) as ReturnType<typeof response> : response(config, current.conversation);
      throw new Error(`Unexpected synthetic mutation ${url}`);
    }
    const params = config.params as Record<string, unknown> | undefined;
    reads.push({url, params: params ?? {}});
    if (url.endsWith("/events")) return response(config, {conversation_id: chatId, items: eventItems, next_cursor: "synthetic-checkpoint", cursor_state: "current", has_more: false});
    if (url.endsWith("/observation")) return response(config, observation);
    if (url.endsWith(`/proposals/${proposal.proposal_id}`)) return response(config, proposal);
    if (url.endsWith("/review-metadata")) return response(config, readonlyReview);
    if (url === `/nodia-ai/runs/${run.run_id}`) return response(config, { ...run, state: "completed", completed_at: conversation.created_at });
    if (url === "/nodia-ai/conversations") return response(config, {items: [current.conversation, other.conversation], next_cursor: null});
    if (url === "/nodia-ai/connections") return response(config, { ...catalog, items: [...catalog.items, ...extraConnections] });
    if (url === "/nodia-ai/attachments/capabilities") return response(config, {
      limits: { file_bytes: 20971520, files_per_message: 4, message_files_bytes: 41943040, audio_seconds: 300, pdf_pages: 100, image_pixels: 12000000 },
      reviewed_text: true, native_modalities: { image: null, pdf: null, audio: null }, native_media_types: [],
    });
    if (url.endsWith("/eligibility")) {
      const observed = {...selection, connection_id: url.split("/").at(-2), mode: params?.mode, model_id: params?.model_id, effort_id: params?.effort_id ?? null};
      return response(config, {selection: observed, available, reason: available ? null : eligibilityReason, observed_at: null, supports_mcp: false, routing_target: available ? routingTarget : null});
    }
    if (url.endsWith("/messages")) return response(config, {conversation_id: url.includes(otherChatId) ? otherChatId : chatId, items: url.includes(otherChatId) ? [] : messageItems, next_cursor: null});
    if (url === `/nodia-ai/conversations/${chatId}`) return response(config, current);
    if (url === `/nodia-ai/conversations/${otherChatId}`) return response(config, other);
    throw new Error(`Unexpected synthetic read ${url}`);
  };
}
function Navigation() {
  const navigation = useNavigate();
  useEffect(() => { navigate = navigation; }, [navigation]);
  return null;
}
function openPage() {
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`/nodia-ai?chat=${chatId}`]}><Navigation /><NodiaAI /></MemoryRouter></QueryClientProvider>);
}
async function readyComposer() {
  const input = await screen.findByRole("textbox", {name: "Mensaje"});
  await waitFor(() => expect(input).toBeEnabled());
  return input;
}
beforeEach(() => {
  extraConnections = []; useGeneralSettingsStore.getState().clearContext();
  current = structuredClone(detail); available = true; eligibilityReason = "nodia_ai:adapter_unavailable"; writes = []; reads = []; messageItems = []; eventItems = []; admitAction = undefined; patchAction = undefined;
  other = {...structuredClone(detail), conversation: {...structuredClone(conversation), conversation_id: otherChatId, title: "Other synthetic chat", revision: 2}};
  client = new QueryClient({queryCache: new QueryCache({onError: notifyHttpError}), defaultOptions: {queries: {retry: false}, mutations: {retry: false}}});
  useAuthStore.setState({user: {id: "9", name: "Synthetic owner"}, token: "synthetic-test-only", expiresAt: Date.now() + 600000, sessionStatus: "authenticated", sessionVersion: 1, isRefreshing: false});
  setupTransport();
});
afterEach(() => { useGeneralSettingsStore.getState().clearContext(); client.clear(); mainInstance.defaults.adapter = originalAdapter; useAuthStore.setState({token: null, user: null, sessionStatus: "anonymous"}); });

describe("NodiaAI page with synthetic authenticated HTTP", () => {
  it("opens a new conversation with the Server-resolved defaults and no configuration modal", async () => {
    extraConnections = [codexConnection];
    other.conversation.selection = codexSelection;
    const original = mainInstance.defaults.adapter;
    if (typeof original !== "function") throw new Error("Missing synthetic test adapter");
    mainInstance.defaults.adapter = async config => {
      if (config.method === "post" && config.url === "/nodia-ai/conversations") {
        writes.push({ url: config.url, body: JSON.parse(config.data as string) as Record<string, unknown> });
        return response(config, other.conversation);
      }
      return original(config);
    };
    const user = userEvent.setup(); openPage(); await readyComposer();
    await user.click(screen.getByRole("button", { name: i18n.t("nodiaAi:new_chat") }));
    await screen.findByRole("heading", { name: "Other synthetic chat" });
    await readyComposer();
    expect(screen.getByRole("button", { name: "Conexión" })).toHaveTextContent(codexConnection.label);
    expect(screen.getByRole("button", { name: "Modelo" })).toHaveTextContent("AI40 discovered Codex model");
    expect(screen.getByRole("button", { name: "Intensidad" })).toHaveTextContent("New observed effort");
    expect(screen.queryByRole("dialog", { name: i18n.t("nodiaAi:configuration.title") })).not.toBeInTheDocument();
    expect(writes).toHaveLength(1);
    expect(writes[0].url).toBe("/nodia-ai/conversations");
    expect(writes[0].body).not.toHaveProperty("selection");
  });

  it("uses the explicitly applied inline selection for the next admission while retaining the previous turn's selection", async () => {
    extraConnections = [{ ...codexConnection, default_mode: "agentic" }];
    const admittedSelections: NodiaAiSelection[] = [];
    admitAction = config => {
      const selected = structuredClone(current.conversation.selection!);
      admittedSelections.push(selected);
      const completed = { ...run, selection: selected, state: "completed" as const, completed_at: conversation.created_at };
      current = { ...current, conversation: { ...current.conversation, revision: current.conversation.revision + 1 }, current_run: completed };
      return response(config, { message_id: messageId, conversation_revision: current.conversation.revision, run: completed });
    };
    patchAction = config => {
      const body = JSON.parse(config.data as string) as { selection: NodiaAiSelection };
      current.conversation = { ...current.conversation, selection: body.selection, revision: current.conversation.revision + 1 };
      return response(config, current.conversation);
    };
    const user = userEvent.setup(); openPage(); const composer = await readyComposer();
    await user.type(composer, "Synthetic first turn");
    await user.click(screen.getByRole("button", { name: "Enviar mensaje" }));
    await waitFor(() => expect(admittedSelections).toEqual([selection]));
    await waitFor(() => expect(composer).toBeEnabled());
    await user.type(composer, "Synthetic second turn");
    await user.click(screen.getByRole("button", { name: "Conexión" }));
    await user.click(await screen.findByRole("option", { name: codexConnection.label }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Aplicar configuración" })).toBeEnabled());
    expect(screen.getByRole("button", { name: "Enviar mensaje" })).toBeDisabled();
    expect(writes).toHaveLength(1);
    expect(composer).toHaveValue("Synthetic second turn");
    await user.click(screen.getByRole("button", { name: "Aplicar configuración" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Enviar mensaje" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Enviar mensaje" }));
    await waitFor(() => expect(admittedSelections).toEqual([selection, codexSelection]));
    expect(writes.map(entry => entry.url)).toEqual([
      `/nodia-ai/conversations/${chatId}/messages`, `/nodia-ai/conversations/${chatId}/selection`, `/nodia-ai/conversations/${chatId}/messages`,
    ]);
    expect(writes[0].body.expected_conversation_revision).toBe(1);
    expect(writes[1].body).toEqual({ expected_conversation_revision: 2, selection: codexSelection });
    expect(writes[2].body.expected_conversation_revision).toBe(3);
  });

  it.each([false, true, undefined])("uses only explicit image qualification %j for the exact API selection's hint without blocking text", async supports_image_generation => {
    current.conversation.selection = { ...selection, mode: "api_key" };
    const original = mainInstance.defaults.adapter;
    if (typeof original !== "function") throw new Error("Missing synthetic test adapter");
    mainInstance.defaults.adapter = async config => {
      const result = await original(config);
      return config.url?.endsWith("/eligibility") && supports_image_generation !== undefined
        ? { ...result, data: { ...result.data, supports_image_generation } } : result;
    };
    openPage();
    const composer = await readyComposer();
    const warning = i18n.t("nodiaAi:image_generation.unverified");
    if (supports_image_generation === false) expect(screen.getByText(warning)).toBeInTheDocument();
    else expect(screen.queryByText(warning)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: i18n.t("nodiaAi:composer.context") })).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t("nodiaAi:image_generation.command_hint"))).not.toBeInTheDocument();
    fireEvent.change(composer, { target: { value: "Synthetic ordinary text" } });
    expect(screen.getByRole("button", { name: "Enviar mensaje" })).toBeEnabled();
    expect(current.conversation.selection).toEqual({ ...selection, mode: "api_key" });
    expect(writes).toEqual([]);
  });

  it("gates invoice OCR originals by fresh matching eligibility without losing the draft or claiming native MIME", async () => {
    current.conversation.selection = agentic;
    const original = mainInstance.defaults.adapter;
    if (typeof original !== "function") throw new Error("Missing synthetic test adapter");
    const attachmentId = "77777777-7777-4777-8777-777777777777";
    const attachment = { attachment_id: attachmentId, conversation_id: chatId, kind: "pdf", state: "uploading", file_name: "invoice.pdf", byte_count: null, media_type: null, page_count: null, duration_seconds: null, interpretation: null };
    let phase = "fresh", uploads = 0;
    let finishObservation!: (value: ReturnType<typeof response>) => void;
    let pendingConfig!: InternalAxiosRequestConfig;
    const eligibilityValue = () => ({ selection: phase === "mismatch" ? { ...agentic, model_id: "synthetic-other-selection" } : agentic,
      available: true, reason: null, observed_at: null, supports_mcp: true, routing_target: null,
      invoice_ocr: { media_types: ["image/png", "image/jpeg", "image/webp", "application/pdf"], file_bytes: 10485760 } });
    mainInstance.defaults.adapter = async config => {
      if (config.url?.endsWith("/eligibility")) {
        if (phase === "error") return rejected(config, 503, "Synthetic eligibility unavailable");
        if (phase === "pending") {
          pendingConfig = config;
          return new Promise<ReturnType<typeof response>>(resolve => { finishObservation = resolve; });
        }
        return response(config, eligibilityValue());
      }
      if (config.url === "/nodia-ai/attachments/capabilities") return response(config, {
        limits: { file_bytes: 20971520, files_per_message: 4, message_files_bytes: 41943040, audio_seconds: 300, pdf_pages: 100, image_pixels: 12000000 },
        reviewed_text: true, native_modalities: { image: null, pdf: null, audio: null }, native_media_types: [],
      });
      if (config.url === "/nodia-ai/attachments" && config.method === "post") return response(config, {
        attachment, upload: { method: "PUT", path: `/nodia-ai/attachments/${attachmentId}/content`, expires_at: conversation.expires_at },
      });
      if (config.url === `/nodia-ai/attachments/${attachmentId}/content` && config.method === "put") {
        uploads++;
        return response(config, { ...attachment, state: "ready", media_type: "application/pdf", byte_count: 9 });
      }
      return original(config);
    };
    const user = userEvent.setup(); openPage(); const composer = await readyComposer();
    await user.type(composer, "Analiza esta factura");
    await waitFor(() => expect(screen.getByRole("button", { name: "Añadir al mensaje" })).toBeEnabled());
    await user.upload(screen.getByLabelText("Elegir archivos", { selector: "input" }), new File(["synthetic"], "invoice.pdf", { type: "application/pdf" }));
    const badge = "Archivo disponible para solicitar extracción de factura";
    expect(await screen.findByText(badge)).toBeInTheDocument();
    expect(screen.queryByText(/Este formato está verificado para la selección actual/)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Enviar mensaje" })).toBeEnabled());
    const refresh = () => client.invalidateQueries({ predicate: query => query.queryKey[3] === "eligibility" });
    phase = "pending";
    act(() => { void refresh(); });
    await waitFor(() => expect(finishObservation).toBeDefined());
    expect(screen.queryByText(badge)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar mensaje" })).toBeDisabled();
    phase = "mismatch";
    await act(async () => finishObservation(response(pendingConfig, eligibilityValue())));
    expect(await screen.findByText("No pudimos comprobar la disponibilidad de esta selección.")).toBeInTheDocument();
    expect(screen.queryByText(badge)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar mensaje" })).toBeDisabled();
    phase = "fresh";
    await act(async () => { await refresh(); });
    expect(await screen.findByText(badge)).toBeInTheDocument();
    phase = "error";
    await act(async () => { await refresh(); });
    await waitFor(() => expect(screen.queryByText(badge)).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Enviar mensaje" })).toBeDisabled();
    expect(composer).toHaveValue("Analiza esta factura");
    expect(screen.getByText("invoice.pdf")).toBeInTheDocument();
    phase = "fresh";
    await act(async () => { await refresh(); });
    await waitFor(() => expect(screen.getByRole("button", { name: "Enviar mensaje" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Enviar mensaje" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.body.parts).toEqual([{ kind: "text", text: "Analiza esta factura" }, { kind: "pdf", attachment_id: attachmentId }]);
    expect(uploads).toBe(1);
  });
  it("changes Gemini and Codex explicitly between turns, preserving history, composer identity, draft and inline selection controls", async () => {
    extraConnections = [codexConnection];
    messageItems = [{ message_id: messageId, run_id: null, seq: "1", role: "assistant", status: "sealed", visibility: "visible", author_user_id: null, created_at: conversation.created_at, sealed_at: conversation.created_at, parts: [{ kind: "text", text: "AI40 previous decisions stay in this conversation" }] }];
    patchAction = config => {
      const body = JSON.parse(config.data as string) as { selection: NodiaAiSelection };
      current.conversation = { ...current.conversation, selection: body.selection, revision: current.conversation.revision + 1 };
      return response(config, current.conversation);
    };
    const user = userEvent.setup(); openPage(); const composer = await readyComposer();
    await user.type(composer, "AI40 next message stays unsent");
    const selectOption = async (field: string, label: string) => {
      await user.click(screen.getByRole("button", { name: field }));
      await user.click(await screen.findByRole("option", { name: label }));
    };
    await waitFor(() => expect(screen.getByRole("button", { name: "Conexión" })).not.toHaveAttribute("aria-disabled", "true"));
    await selectOption("Conexión", codexConnection.label);
    await selectOption("Modo", i18n.t("nodiaAi:modes.agentic"));
    expect(writes).toEqual([]);
    expect(screen.getByRole("button", { name: "Modelo" })).toHaveTextContent("AI40 discovered Codex model");
    expect(screen.queryByRole("switch", { name: "Alternar automáticamente a Agentic" })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Aplicar configuración" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Aplicar configuración" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("button", { name: "Conexión" })).toBeEnabled());
    expect(screen.getByRole("textbox", { name: "Mensaje" })).toBe(composer);
    expect(composer).toHaveValue("AI40 next message stays unsent");
    expect(screen.getByText("AI40 previous decisions stay in this conversation")).toBeInTheDocument();
    expect(writes).toHaveLength(1);
    expect(writes[0]).toEqual({ url: `/nodia-ai/conversations/${chatId}/selection`, body: { expected_conversation_revision: 1, selection: codexSelection } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Conexión" })).not.toHaveAttribute("aria-disabled", "true"));
    await selectOption("Conexión", "Synthetic connection");
    await selectOption("Modo", i18n.t("nodiaAi:modes.agentic"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Aplicar configuración" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Aplicar configuración" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(composer).toHaveValue("AI40 next message stays unsent");
    expect(screen.getByText("AI40 previous decisions stay in this conversation")).toBeInTheDocument();
    expect(writes).toHaveLength(2);
    expect(writes[1].body).toEqual({ expected_conversation_revision: 2, selection });
    expect(writes.every(entry => entry.url.endsWith("/selection"))).toBe(true);
  });

  it("keeps private account management out of the compact composer while preserving the draft across access changes", async () => {
    extraConnections = [codexConnection];
    current.conversation.selection = codexSelection;
    const user = userEvent.setup(); openPage(); const composer = await readyComposer();
    await user.type(composer, "AI40 private draft");
    expect(screen.queryByRole("button", { name: "Configuración" })).not.toBeInTheDocument();
    const linkName = i18n.t("nodiaAi:configuration.codex_manage");
    expect(screen.queryByRole("link", { name: linkName })).not.toBeInTheDocument();
    await act(() => useGeneralSettingsStore.setState({ isLoaded: true, actions: [{ key: "ai:manage", description: null, translates: [] }] }));
    expect(screen.queryByRole("link", { name: linkName })).not.toBeInTheDocument();
    await act(() => useGeneralSettingsStore.setState({ modules: [{ module_group_key: "synthetic", translates: [], modules: [{ key: "ai-providers", link: "/ai-providers", translates: [] }] }] }));
    expect(screen.queryByRole("link", { name: linkName })).not.toBeInTheDocument();
    await act(() => useGeneralSettingsStore.setState({ actions: [] }));
    expect(screen.queryByRole("link", { name: linkName })).not.toBeInTheDocument();
    await act(() => useGeneralSettingsStore.setState({ modules: [] }));
    expect(screen.queryByRole("link", { name: linkName })).not.toBeInTheDocument();
    await act(() => useGeneralSettingsStore.setState({ roles: ["super_admin"] }));
    expect(screen.queryByRole("link", { name: linkName })).not.toBeInTheDocument();
    expect(composer).toHaveValue("AI40 private draft");
    expect(writes).toEqual([]);
  });

  it("keeps the visible message anchor when an older page resolves before React Query delivers the DOM update", async () => {
    const item = (position: number): NodiaAiMessagePage["items"][number] => ({
      message_id: `90000000-0000-4000-8000-${String(position).padStart(12, "0")}`, run_id: null, seq: String(position), role: "assistant", status: "sealed",
      visibility: "visible", author_user_id: null, created_at: conversation.created_at, sealed_at: conversation.created_at,
      parts: [{ kind: "text", text: position === 11 ? "AI35 retained visible message anchor" : `AI35 synthetic historical message ${position}` }],
    });
    const latest = [item(11), item(12)], older = [item(1), item(2), item(3), item(4), item(5)];
    const base = mainInstance.defaults.adapter;
    if (typeof base !== "function") throw new Error("Missing synthetic adapter");
    mainInstance.defaults.adapter = async config => {
      if (config.url !== `/nodia-ai/conversations/${chatId}/messages`) return base(config);
      reads.push({ url: config.url, params: config.params });
      return response(config, { conversation_id: chatId, items: config.params?.cursor ? older : latest, next_cursor: config.params?.cursor ? null : "synthetic-older-anchor" });
    };
    const user = userEvent.setup(); openPage();
    const composer = await readyComposer();
    await user.type(composer, "AI35 draft survives prepending history");
    const viewport = screen.getByRole("region", { name: "Mensajes del chat" });
    const anchor = screen.getByText("AI35 retained visible message anchor").closest("article")!;
    // JSDOM has no layout. Model fixed-height message boxes while deriving the
    // scroll extent and anchor position from the actual rendered message order.
    Object.defineProperty(viewport, "scrollHeight", { configurable: true, get: () => 100 + viewport.querySelectorAll("article").length * 360 });
    Object.defineProperty(viewport, "clientHeight", { configurable: true, get: () => 300 });
    vi.spyOn(anchor, "getBoundingClientRect").mockImplementation(() => new DOMRect(0, Array.from(viewport.querySelectorAll("article")).indexOf(anchor) * 360 - viewport.scrollTop, 0, 360));
    viewport.scrollTop = 100; fireEvent.scroll(viewport);
    const before = anchor.getBoundingClientRect().top;
    const notifications: (() => void)[] = [];
    notifyManager.setScheduler(callback => { notifications.push(callback); });
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { callback(0); return 1; });
    try {
      fireEvent.click(screen.getByRole("button", { name: "Cargar mensajes anteriores" }));
      await waitFor(() => expect(client.getQueryData<InfiniteData<NodiaAiMessagePage>>(["nodia-ai", "9", 1, "messages", chatId])?.pages).toHaveLength(2));
      expect(viewport.querySelectorAll("article")).toHaveLength(2);
      await act(async () => { while (notifications.length) notifications.shift()?.(); });
      await waitFor(() => expect(viewport.querySelectorAll("article")).toHaveLength(7));
      expect(anchor.getBoundingClientRect().top).toBe(before);
      expect(viewport.scrollTop).toBeGreaterThan(100);
      expect(composer).toHaveValue("AI35 draft survives prepending history");
      expect(writes).toEqual([]);
    } finally {
      notifyManager.setScheduler(defaultScheduler);
      raf.mockRestore();
      await act(async () => { while (notifications.length) notifications.shift()?.(); });
    }
  });
  it("opens saved preferences from the conversation menu without duplicate drawer identities or loss of the composer draft", async () => {
    const errors = vi.spyOn(console, "error");
    const base = mainInstance.defaults.adapter;
    if (typeof base !== "function") throw new Error("Missing synthetic adapter");
    mainInstance.defaults.adapter = async config => {
      if (config.url === "/nodia-ai/preferences") return response(config, { items: [], next_cursor: null });
      if (config.url === "/nodia-ai/preferences/catalog") return response(config, { items: [] });
      return base(config);
    };
    try {
      const user = userEvent.setup(); openPage();
      const composer = await readyComposer();
      await user.type(composer, "AI35 preserve draft across independent drawers");
      expect(screen.queryByRole("button", { name: "Configuración" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Preferencias" })).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Conversaciones" }));
      await user.click(await screen.findByRole("button", { name: i18n.t("nodiaAi:organization.actions", { title: i18n.t("nodiaAi:untitled") }) }));
      await user.click(screen.getByRole("menuitem", { name: i18n.t("nodiaAi:organization.saved_preferences") }));
      await screen.findByText("Todavía no has aceptado ninguna preferencia.");
      const preferences = screen.getByRole("dialog", { name: "Preferencias" });
      await waitFor(() => expect(within(preferences).getByRole("button", { name: "Cerrar" })).toBeEnabled());
      await user.click(within(preferences).getByRole("button", { name: "Cerrar" }));
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Preferencias" })).not.toBeInTheDocument());
      await user.click(composer);
      expect(composer).toHaveValue("AI35 preserve draft across independent drawers");
      expect(composer).toHaveFocus();
      expect(writes).toEqual([]);
      const duplicateKeys = errors.mock.calls.filter(args => args.some(value => typeof value === "string" && /same key|unique.*key/i.test(value)));
      expect(duplicateKeys).toEqual([]);
    } finally { errors.mockRestore(); }
  });
  it("retains the rename modal and composer draft after 503, then explicitly refreshes CAS and retries with one toast per mutation", async () => {
    current.conversation.title = "AI35 synthetic original";
    let attempt = 0;
    patchAction = config => {
      if (++attempt === 1) return rejected(config, 503, "Synthetic title unavailable");
      const body = JSON.parse(String(config.data)) as { title: string; expected_conversation_revision: number };
      current.conversation = { ...current.conversation, title: body.title, revision: body.expected_conversation_revision + 1 };
      return response(config, current.conversation);
    };
    const user = userEvent.setup(); openPage();
    const composer = await readyComposer();
    await user.type(composer, "AI35 next message remains private and unsent");
    await user.click(screen.getByRole("button", { name: "Conversaciones" }));
    await user.click(await screen.findByRole("button", { name: "Acciones de AI35 synthetic original" }));
    await user.click(screen.getByRole("menuitem", { name: "Renombrar" }));
    const dialog = await screen.findByRole("dialog", { name: "Renombrar" });
    const title = within(dialog).getByRole("textbox", { name: "Título de la conversación" });
    await waitFor(() => expect(title).toBeEnabled());
    await user.clear(title); await user.type(title, "AI35 corrected title");
    vi.mocked(sileo.error).mockClear(); vi.mocked(sileo.success).mockClear();
    await user.click(within(dialog).getByRole("button", { name: "Guardar título" }));
    expect(await within(dialog).findByText("Synthetic title unavailable")).toBeInTheDocument();
    expect(title).toHaveValue("AI35 corrected title");
    expect(composer).toHaveValue("AI35 next message remains private and unsent");
    expect(writes).toHaveLength(1);
    expect(sileo.error).toHaveBeenCalledOnce(); expect(sileo.success).not.toHaveBeenCalled();
    current.conversation = { ...current.conversation, revision: 2 };
    await user.click(within(dialog).getByRole("button", { name: "Revisar estado actual" }));
    const save = within(dialog).getByRole("button", { name: "Guardar título" });
    await waitFor(() => expect(save).toBeEnabled());
    expect(title).toHaveValue("AI35 corrected title");
    expect(writes).toHaveLength(1);
    await user.click(save);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Renombrar" })).not.toBeInTheDocument());
    expect(writes.map(item => item.body.expected_conversation_revision)).toEqual([1, 2]);
    expect(writes.every(item => item.url === `/nodia-ai/conversations/${chatId}`)).toBe(true);
    expect(sileo.error).toHaveBeenCalledOnce(); expect(sileo.success).toHaveBeenCalledOnce();
    expect(composer).toHaveValue("AI35 next message remains private and unsent");
    expect(await screen.findByRole("heading", { name: "AI35 corrected title" })).toBeInTheDocument();
  });
  it("keeps a conflicted title for an explicit CAS refresh instead of automatically repeating the PATCH", async () => {
    current.conversation.title = "AI35 conflict original";
    patchAction = config => { current.conversation = { ...current.conversation, revision: 4 }; return rejected(config, 409, "nodia_ai:revision_conflict"); };
    const user = userEvent.setup(); openPage(); await readyComposer();
    await user.click(screen.getByRole("button", { name: "Conversaciones" }));
    await user.click(await screen.findByRole("button", { name: "Acciones de AI35 conflict original" }));
    await user.click(screen.getByRole("menuitem", { name: "Renombrar" }));
    const dialog = await screen.findByRole("dialog", { name: "Renombrar" });
    const title = within(dialog).getByRole("textbox", { name: "Título de la conversación" });
    await waitFor(() => expect(title).toBeEnabled());
    fireEvent.change(title, { target: { value: "AI35 unsaved after conflict" } });
    await user.click(within(dialog).getByRole("button", { name: "Guardar título" }));
    await within(dialog).findByRole("button", { name: "Revisar estado actual" });
    expect(writes).toHaveLength(1);
    expect(title).toHaveValue("AI35 unsaved after conflict");
    await user.click(within(dialog).getByRole("button", { name: "Revisar estado actual" }));
    await waitFor(() => expect(title).toBeEnabled());
    expect(writes).toHaveLength(1);
    expect(title).toHaveValue("AI35 unsaved after conflict");
  });
  it("sends search, archive and pin filters to the backend and resets pagination when the search changes", async () => {
    const base = mainInstance.defaults.adapter;
    if (typeof base !== "function") throw new Error("Missing synthetic adapter");
    mainInstance.defaults.adapter = async config => {
      if (config.url !== "/nodia-ai/conversations") return base(config);
      const params = config.params as Record<string, unknown>;
      reads.push({ url: config.url, params: { ...params } });
      return response(config, { items: params.cursor ? [other.conversation] : [current.conversation], next_cursor: params.cursor ? null : "synthetic-page-two" });
    };
    const user = userEvent.setup(); openPage(); await readyComposer();
    await user.click(screen.getByRole("button", { name: "Conversaciones" }));
    await user.click(await screen.findByRole("button", { name: "Cargar más conversaciones" }));
    await waitFor(() => expect(reads.some(item => item.url === "/nodia-ai/conversations" && item.params.cursor === "synthetic-page-two")).toBe(true));
    expect(await screen.findByRole("button", { name: /^Other synthetic chat/ })).toBeInTheDocument();
    const search = screen.getByRole("textbox", { name: "Buscar por título o texto" });
    await user.type(search, "AI35 supplier");
    await waitFor(() => expect(reads.some(item => item.url === "/nodia-ai/conversations" && item.params.search === "AI35 supplier" && item.params.cursor === undefined)).toBe(true));
    await user.click(screen.getByRole("button", { name: "Mostrar filtros de conversaciones" }));
    await waitFor(() => expect(screen.getByRole("switch", { name: "Sólo fijadas" })).toBeEnabled());
    await user.click(screen.getByRole("switch", { name: "Sólo fijadas" }));
    await waitFor(() => expect(reads.some(item => item.url === "/nodia-ai/conversations" && item.params.is_pinned === true && item.params.search === "AI35 supplier")).toBe(true));
    await waitFor(() => expect(screen.getByRole("button", { name: "Conversaciones" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Conversaciones" }));
    await user.click(await screen.findByRole("option", { name: "Archivadas" }));
    await waitFor(() => expect(reads.some(item => item.url === "/nodia-ai/conversations" && item.params.is_archived === true && item.params.is_pinned === true && item.params.search === "AI35 supplier" && item.params.cursor === undefined)).toBe(true));
    expect(writes).toEqual([]);
  });
  it.each(["detail", "messages"] as const)("withdraws private content after a %s read returns 403 without replaying a message", async kind => {
    messageItems = [{ message_id: messageId, run_id: null, seq: "1", role: "assistant", status: "sealed", created_at: conversation.created_at, visibility: "visible", author_user_id: null, sealed_at: conversation.created_at, parts: [{ kind: "text", text: "AI35 private historical content" }] }];
    openPage(); const composer = await readyComposer();
    fireEvent.change(composer, { target: { value: "AI35 private unsent draft" } });
    const base = mainInstance.defaults.adapter;
    if (typeof base !== "function") throw new Error("Missing synthetic adapter");
    const path = `/nodia-ai/conversations/${chatId}${kind === "messages" ? "/messages" : ""}`;
    mainInstance.defaults.adapter = async config => config.url === path ? rejected(config, 403, "Synthetic access withdrawn") : base(config);
    await act(() => client.invalidateQueries({ queryKey: ["nodia-ai", "9", 1, kind, chatId] }));
    expect(await screen.findByText("Esta conversación ya no está disponible para tu sesión. Su contenido se ha ocultado.")).toBeInTheDocument();
    expect(screen.queryByText("AI35 private historical content")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Mensaje" })).not.toBeInTheDocument();
    expect(writes).toEqual([]);
  });
  it.each(["detail", "messages"] as const)("preserves visible content and its new draft through a transient %s failure and explicit recovery", async kind => {
    messageItems = [{ message_id: messageId, run_id: null, seq: "1", role: "assistant", status: "sealed", created_at: conversation.created_at, visibility: "visible", author_user_id: null, sealed_at: conversation.created_at, parts: [{ kind: "text", text: "AI35 retained historical content" }] }];
    openPage(); const composer = await readyComposer();
    fireEvent.change(composer, { target: { value: "AI35 retained draft after transient outage" } });
    const base = mainInstance.defaults.adapter;
    if (typeof base !== "function") throw new Error("Missing synthetic adapter");
    const path = `/nodia-ai/conversations/${chatId}${kind === "messages" ? "/messages" : ""}`;
    mainInstance.defaults.adapter = async config => config.url === path ? rejected(config, 500, "Synthetic transient outage") : base(config);
    await act(() => client.invalidateQueries({ queryKey: ["nodia-ai", "9", 1, kind, chatId] }));
    const retry = await screen.findByRole("button", { name: "Reintentar" });
    expect(screen.getByText("AI35 retained historical content")).toBeInTheDocument();
    expect(composer).toHaveValue("AI35 retained draft after transient outage");
    expect(screen.getByRole("button", { name: "Enviar mensaje" })).toBeDisabled();
    expect(screen.queryByText("Esta conversación ya no está disponible para tu sesión. Su contenido se ha ocultado.")).not.toBeInTheDocument();
    mainInstance.defaults.adapter = base;
    await userEvent.click(retry);
    await waitFor(() => expect(composer).toBeEnabled());
    expect(composer).toHaveValue("AI35 retained draft after transient outage");
    expect(screen.getByText("AI35 retained historical content")).toBeInTheDocument();
    expect(writes).toEqual([]);
  });
  it("labels a persisted partial answer without treating it as a new dispatch or blocking a separate new draft", async () => {
    messageItems = [{ message_id: messageId, run_id: null, seq: "1", role: "assistant", status: "partial", created_at: conversation.created_at, visibility: "visible", author_user_id: null, sealed_at: conversation.created_at, parts: [{ kind: "text", text: "AI35 partial saved answer" }] }];
    openPage(); const composer = await readyComposer();
    expect(screen.getByText("Respuesta parcial: este mensaje no se completó.")).toBeInTheDocument();
    expect(screen.getByText("AI35 partial saved answer")).toBeInTheDocument();
    fireEvent.change(composer, { target: { value: "AI35 independent next message" } });
    await act(() => client.invalidateQueries({ queryKey: ["nodia-ai", "9", 1, "messages", chatId] }));
    expect(composer).toHaveValue("AI35 independent next message");
    expect(writes).toEqual([]);
  });
  it.each([
    ["es", "compaction_invalid", /No pudimos validar el resumen de la conversación/],
    ["es", "context_sources_changed", /El contexto cambió durante el turno/],
    ["es", "context_snapshot_invalid", /No pudimos usar el contexto compactado/],
    ["es", "context_limit", /El contexto no cabe en este turno/],
    ["en", "compaction_invalid", /We could not validate the conversation summary/],
    ["en", "context_sources_changed", /The context changed during this turn/],
    ["en", "context_snapshot_invalid", /We could not use the compacted context/],
    ["en", "context_limit", /The context does not fit within this turn/],
  ] as const)("explains %s %s while preserving a newer draft and sending no implicit request", async (language, code, expected) => {
    await i18n.changeLanguage(language);
    current.current_run = { ...run, state: "failed",
      budget_used: { ...run.budget_used, provider_dispatches: 1, compactions: 1 },
      error: { code: `nodia_ai:${code}`, message_key: `nodia_ai:${code}`, field_errors: [], retry_action: "none", correlation_id: run.run_id } };
    messageItems = [{ message_id: messageId, run_id: null, seq: "1", role: "user", status: "sealed",
      created_at: conversation.created_at, visibility: "visible", author_user_id: "9", sealed_at: conversation.created_at,
      parts: [{ kind: "text", text: "Original admitted synthetic request" }] }];
    const user = userEvent.setup(); openPage();
    const input = await screen.findByRole("textbox", { name: language === "es" ? "Mensaje" : "Message" });
    await waitFor(() => expect(input).toBeEnabled());
    await user.type(input, "A newer explicit request draft");
    const feedback = screen.getByText(expected);
    expect(feedback).toHaveTextContent(language === "es" ? "El historial original se conserva" : "The original history is preserved");
    expect(feedback).toHaveTextContent(language === "es" ? /no se repetirá automáticamente/ : /not be repeated automatically/);
    expect(feedback).not.toHaveTextContent(language === "es" ? /no se envió al proveedor/ : /not sent to the provider/);
    expect(screen.getByText("Original admitted synthetic request")).toBeInTheDocument();
    await act(() => client.invalidateQueries({ queryKey: ["nodia-ai", "9", 1, "detail", chatId] }));
    expect(input).toHaveValue("A newer explicit request draft");
    expect(input).toHaveFocus();
    expect(screen.queryByRole("button", { name: /^(Reintentar|Retry)$/ })).not.toBeInTheDocument();
    expect(writes).toEqual([]);
  });
  it.each(["es", "en"] as const)("keeps reconciliation blocking intact beside %s context feedback", async language => {
    await i18n.changeLanguage(language);
    current.current_run = { ...run, state: "unknown", error: { code: "nodia_ai:context_sources_changed",
      message_key: "nodia_ai:context_sources_changed", field_errors: [], retry_action: "none", correlation_id: run.run_id } };
    openPage();
    expect(await screen.findByText(language === "es" ? /El resultado requiere conciliación/ : /This result needs reconciliation/)).toBeInTheDocument();
    expect(screen.getByText(language === "es" ? /El contexto cambió durante el turno/ : /The context changed during this turn/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: language === "es" ? "Enviar mensaje" : "Send message" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: language === "es" ? "Mensaje" : "Message" })).toHaveValue("");
    await userEvent.click(screen.getByRole("button", { name: language === "es" ? "Actualizar estado" : "Refresh status" }));
    expect(writes).toEqual([]);
  });
  it("explains a pre-dispatch preference change without retrying or replacing a new draft", async () => {
    current.current_run = { ...run, state: "failed", error: { code: "nodia_ai:preferences_changed", message_key: "nodia_ai:preferences_changed", field_errors: [], retry_action: "none", correlation_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } };
    const user = userEvent.setup();openPage();
    const input = await readyComposer();
    await user.type(input, "Another explicit request draft");
    expect(screen.getByText(/Las preferencias cambiaron durante el turno/)).toBeInTheDocument();
    expect(screen.queryByText(/la solicitud no se envió al proveedor/)).not.toBeInTheDocument();
    expect(input).toHaveValue("Another explicit request draft");
    expect(writes).toEqual([]);
  });
  it("does not resurrect an admitted message after a later compaction failure or replace a newer draft", async () => {
    const user = userEvent.setup(); openPage();
    const input = await readyComposer();
    await user.type(input, "Original synthetic request already admitted");
    await user.click(screen.getByRole("button", { name: "Enviar mensaje" }));
    await waitFor(() => expect(writes.filter((entry) => entry.url.endsWith("/messages"))).toHaveLength(1));
    await waitFor(() => expect(input).toHaveValue(""));
    current.current_run = { ...run, state: "failed",
      budget_used: { ...run.budget_used, provider_dispatches: 1, compactions: 1 },
      error: { code: "nodia_ai:context_limit", message_key: "nodia_ai:context_limit", field_errors: [], retry_action: "none", correlation_id: run.run_id } };
    await act(() => client.invalidateQueries({ queryKey: ["nodia-ai", "9", 1, "detail", chatId] }));
    await screen.findByText(/El contexto no cabe en este turno/);
    await waitFor(() => expect(input).toBeEnabled());
    expect(input).toHaveValue("");
    await user.type(input, "Keep this newer explicit draft");
    await act(() => client.invalidateQueries({ queryKey: ["nodia-ai", "9", 1, "detail", chatId] }));
    expect(input).toHaveValue("Keep this newer explicit draft");
    expect(writes.filter((entry) => entry.url.endsWith("/messages"))).toHaveLength(1);
    expect(writes.filter((entry) => entry.url.endsWith("/selection"))).toEqual([]);
  });
  it("preserves dictation by blocking history loading and requires explicit send without uploading audio", async () => {
    const original = mainInstance.defaults.adapter;
    if (typeof original !== "function") throw new Error("Missing synthetic test adapter");
    const stopped = vi.fn(), released = vi.fn();
    class SyntheticRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      onstart: (() => void) | null = null;
      onresult: ((event: { results: { 0: { 0: { transcript: string }; length: number; isFinal: boolean }; length: number } }) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      start() { this.onstart?.(); }
      stop() {
        stopped();
        this.onresult?.({ results: { 0: { 0: { transcript: "palabras dictadas" }, length: 1, isFinal: true }, length: 1 } });
        this.onend?.();
      }
      abort() {}
    }
    const previousMediaDevices = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
    const track = { stop: released, readyState: "live", addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [track], getAudioTracks: () => [track] });
    vi.stubGlobal("SpeechRecognition", SyntheticRecognition);
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
    let historyRequests = 0, uploadIntents = 0;
    mainInstance.defaults.adapter = async config => {
      if (config.url === "/nodia-ai/attachments/capabilities")
        return response(config, { limits: { file_bytes: 20971520, files_per_message: 4, message_files_bytes: 41943040, audio_seconds: 300, pdf_pages: 100, image_pixels: 12000000 }, reviewed_text: true, native_modalities: { image: null, pdf: null, audio: true }, native_media_types: ["audio/webm"] });
      if (config.method === "post" && config.url === "/nodia-ai/attachments") uploadIntents++;
      if (config.method === "get" && config.url === `/nodia-ai/conversations/${chatId}/messages`) {
        historyRequests++;
        return response(config, { conversation_id: chatId, items: [], next_cursor: "synthetic-older-cursor" });
      }
      return original(config);
    };
    try {
      const user = userEvent.setup();
      openPage(); const input = await readyComposer();
      await user.type(input, "Borrador previo");
      const older = await screen.findByRole("button", { name: "Cargar mensajes anteriores" });
      const record = await screen.findByRole("button", { name: "Dictar mensaje" });
      await waitFor(() => expect(record).toBeEnabled());
      await user.click(record);
      const stop = await screen.findByRole("button", { name: "Terminar dictado" });
      expect(getUserMedia).toHaveBeenCalledOnce();
      expect(older).toBeDisabled();
      const before = historyRequests;
      // A disabled MUI button has pointer-events:none; dispatching the click
      // directly also verifies React never reaches the pagination handler.
      fireEvent.click(older);
      expect(historyRequests).toBe(before);
      expect(stopped).not.toHaveBeenCalled();
      expect(released).not.toHaveBeenCalled();
      expect(stop).toBeEnabled();
      await user.click(stop);
      await waitFor(() => expect(input).toHaveValue("Borrador previo palabras dictadas"));
      expect(stopped).toHaveBeenCalledOnce();
      expect(released).toHaveBeenCalledOnce();
      await waitFor(() => expect(older).toBeEnabled());
      expect(uploadIntents).toBe(0);
      expect(writes.filter(entry => entry.url.endsWith("/messages"))).toHaveLength(0);
      await user.click(screen.getByRole("button", { name: "Enviar mensaje" }));
      await waitFor(() => expect(writes.filter(entry => entry.url.endsWith("/messages"))).toHaveLength(1));
      expect(uploadIntents).toBe(0);
    } finally {
      vi.unstubAllGlobals();
      if (previousMediaDevices) Object.defineProperty(navigator, "mediaDevices", previousMediaDevices);
      else Reflect.deleteProperty(navigator, "mediaDevices");
    }
  });
  it("sends verified native attachments by ID and recovers the same uncertain admission after capability revocation", async () => {
    const original = mainInstance.defaults.adapter;
    if (typeof original !== "function") throw new Error("Missing synthetic test adapter");
    const attachmentId = "77777777-7777-4777-8777-777777777777";
    const attachment = { attachment_id: attachmentId, conversation_id: chatId, kind: "pdf", state: "uploading", file_name: "synthetic.pdf", byte_count: null, media_type: null, page_count: null, duration_seconds: null, interpretation: null };
    let native = true, uploadIntents = 0, binaryUploads = 0, admissions = 0;
    mainInstance.defaults.adapter = async config => {
      if (config.url === "/nodia-ai/attachments/capabilities") {
        expect(config.params.conversation_id).toBe(chatId);
        return response(config, { limits: { file_bytes: 20971520, files_per_message: 4, message_files_bytes: 41943040, audio_seconds: 300, pdf_pages: 100, image_pixels: 12000000 }, reviewed_text: true, native_modalities: { image: null, pdf: native ? true : null, audio: null }, native_media_types: native ? ["application/pdf"] : [] });
      }
      if (config.url === "/nodia-ai/attachments" && config.method === "post") {
        uploadIntents++;
        return response(config, { attachment, upload: { method: "PUT", path: `/nodia-ai/attachments/${attachmentId}/content`, expires_at: conversation.expires_at } });
      }
      if (config.url === `/nodia-ai/attachments/${attachmentId}/content` && config.method === "put") {
        binaryUploads++;
        return response(config, { ...attachment, state: "ready", byte_count: 7, media_type: "application/pdf", page_count: 1 });
      }
      return original(config);
    };
    admitAction = config => {
      if (++admissions === 1) { accepted(config); native = false; throw new AxiosError("Synthetic response lost", "ECONNABORTED", config); }
      return response(config, { message_id: messageId, conversation_revision: current.conversation.revision, run });
    };
    const user = userEvent.setup();
    openPage(); await readyComposer();
    await waitFor(() => expect(screen.getByRole("button", { name: "Añadir al mensaje" })).toBeEnabled());
    await user.upload(screen.getByLabelText("Elegir archivos", { selector: "input" }), new File(["%PDF-qa"], "synthetic.pdf", { type: "application/pdf" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Enviar mensaje" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Enviar mensaje" }));
    const recover = await screen.findByRole("button", { name: "Comprobar el mismo envío" });
    await waitFor(() => expect(recover).toBeEnabled());
    await user.click(recover);
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[0]?.body.parts).toEqual([{ kind: "pdf", attachment_id: attachmentId }]);
    expect(writes[1]).toEqual(writes[0]);
    expect(uploadIntents).toBe(1);
    expect(binaryUploads).toBe(1);
  });
  it.each(["queued", "running", "waiting_for_user", "cancel_requested", "unknown"] as const)("recovers %s execution metadata and blocks new messages without replaying any POST", async state => {
    current = { ...current, active_execution: { ...execution, state } };
    openPage();
    await screen.findByText(/Estado de la operación:/);
    expect(screen.getByRole("textbox", { name: "Mensaje" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enviar mensaje" })).toBeDisabled();
    expect(writes).toEqual([]);
  });
  it("loads historical run activity only on intent and never exposes controls on a restricted message", async () => {
    const user = userEvent.setup();
    messageItems = [
      { message_id: messageId, run_id: run.run_id, seq: "2", role: "assistant", status: "sealed", created_at: conversation.created_at, visibility: "visible", author_user_id: null, sealed_at: conversation.created_at, parts: [{ kind: "text", text: "Historical synthetic answer" }] },
      { message_id: otherChatId, run_id: run.run_id, seq: "3", role: "assistant", status: "sealed", created_at: conversation.created_at, visibility: "restricted" },
    ];
    eventItems = [toolEvent];
    openPage();
    expect(await screen.findByText("Historical synthetic answer")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: "Ver actividad del turno" });
    expect(buttons).toHaveLength(1);
    expect(reads.filter(item => item.url.includes("/runs/"))).toEqual([]);
    await user.click(buttons[0]);
    await screen.findByRole("button", { name: "Ver resultado de consulta" });
    expect(reads.filter(item => item.url === `/nodia-ai/runs/${run.run_id}`)).toHaveLength(1);
    expect(writes).toEqual([]);
  });
  it("preserves a focused draft when durable events refresh and never resends a completed turn", async () => {
    current.current_run = { ...run, state: "completed", completed_at: conversation.created_at };
    eventItems = [acceptedEvent];
    const user = userEvent.setup(); openPage();
    const input = await readyComposer();
    await user.type(input, "Keep this next-turn draft");
    eventItems = [acceptedEvent, toolEvent];
    await act(() => client.invalidateQueries({ queryKey: ["nodia-ai", "9", 1, "events", chatId, run.run_id] }));
    await screen.findByRole("button", { name: "Ver resultado de consulta" });
    expect(input).toHaveValue("Keep this next-turn draft");
    expect(input).toHaveFocus();
    expect(writes).toEqual([]);
    expect(reads.filter(item => item.url.endsWith("/observation"))).toEqual([]);
  });
  it("keeps the composer draft and focus when observing and rereading an immutable proposal", async () => {
    current.current_run = { ...run, state: "completed", completed_at: conversation.created_at };
    eventItems = [proposalEvent];
    const user = userEvent.setup(); openPage();
    const input = await readyComposer();
    await user.type(input, "Preserve my next message while reviewing");
    await user.click(await screen.findByRole("button", { name: "Ver propuesta" }));
    await screen.findByText("Revisión 1");
    await user.click(input);
    await act(() => client.invalidateQueries({ predicate: query => query.queryKey.includes("proposal") }));
    expect(input).toHaveValue("Preserve my next message while reviewing");
    expect(input).toHaveFocus();
    expect(writes).toEqual([]);
    const proposalReads = reads.filter(item => item.url.includes("/proposals/"));
    expect(proposalReads.length).toBeGreaterThanOrEqual(2);
    expect(proposalReads.every(item => item.params.revision === proposal.revision)).toBe(true);
  });
  it("restores a URL chat and its terminal answer through bounded GETs without resending", async () => {
    current.current_run = {...run, state: "completed", completed_at: conversation.created_at, assistant_message_id: messageId};
    messageItems = [{message_id: messageId, run_id: null, seq: "2", role: "assistant", status: "sealed", created_at: conversation.created_at, visibility: "visible", author_user_id: null, sealed_at: conversation.created_at, parts: [{kind: "text", text: "Synthetic persisted answer"}]}];
    openPage();
    expect(await screen.findByText("Synthetic persisted answer")).toBeInTheDocument();
    await readyComposer();
    expect(writes).toEqual([]);
    expect(reads.find(entry => entry.url.endsWith("/messages"))?.params.direction).toBe("backward");
  });
  it("admits a clarification as a new message after waiting_for_user without replaying the previous turn", async () => {
    current.current_run = { ...run, state: "waiting_for_user", phase: "clarification" };
    current.conversation.revision = 3;
    messageItems = [{ message_id: messageId, run_id: run.run_id, seq: "1", role: "user", status: "sealed", created_at: conversation.created_at, visibility: "visible", author_user_id: "9", sealed_at: conversation.created_at, parts: [{ kind: "text", text: "Earlier synthetic expense request" }] }];
    const nextRunId = "88888888-8888-4888-8888-888888888888";
    admitAction = config => {
      const body = JSON.parse(config.data as string) as { client_message_id: string };
      current = { ...current, conversation: { ...current.conversation, revision: 4 }, current_run: { ...run, run_id: nextRunId, user_message_id: body.client_message_id } };
      return response(config, { message_id: body.client_message_id, conversation_revision: 4, run: current.current_run });
    };
    const user = userEvent.setup(); openPage();
    const input = await readyComposer();
    expect(writes).toEqual([]);
    await user.type(input, "The category is food and the expense is paid");
    await user.click(screen.getByRole("button", { name: "Enviar mensaje" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0].body.client_message_id).not.toBe(messageId);
    expect(writes[0].body.expected_conversation_revision).toBe(3);
    expect(writes[0].body.parts).toEqual([{ kind: "text", text: "The category is food and the expense is paid" }]);
    await screen.findByText("Turno en cola");
    expect(input).toBeDisabled();
    expect(input).toHaveValue("");
  });
  it.each(["queued", "running", "cancel_requested"] as const)("keeps the composer blocked while the previous turn is %s", async state => {
    current.current_run = { ...run, state };
    openPage();
    const input = await screen.findByRole("textbox", { name: "Mensaje" });
    await waitFor(() => expect(reads.some(entry => entry.url.endsWith("/eligibility"))).toBe(true));
    expect(input).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enviar mensaje" })).toBeDisabled();
    expect(writes).toEqual([]);
  });

  it("keeps the same message identity and content when the admitted response is uncertain", async () => {
    let count = 0;
    admitAction = config => {
      count++;
      if (count === 1) { accepted(config); throw new AxiosError("Synthetic timeout", "ECONNABORTED", config); }
      return response(config, {message_id: messageId, conversation_revision: current.conversation.revision, run});
    };
    const user = userEvent.setup(); openPage();
    await user.type(await readyComposer(), "Keep my original request");
    await user.click(screen.getByRole("button", {name: "Enviar mensaje"}));
    const recover = await screen.findByRole("button", {name: "Comprobar el mismo envío"});
    await waitFor(() => expect(recover).toBeEnabled());
    expect(writes).toHaveLength(1);
    expect(screen.getByRole("textbox", {name: "Mensaje"})).toHaveValue("Keep my original request");
    await user.click(recover);
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1]).toEqual(writes[0]);
    await waitFor(() => expect(screen.getByRole("textbox", {name: "Mensaje"})).toHaveValue(""));
  });

  it("preserves the draft after a revision conflict and retries explicitly with the fresh revision", async () => {
    let count = 0;
    admitAction = config => {
      if (++count === 1) { current.conversation.revision = 2; return rejected(config, 409, "nodia_ai:revision_conflict"); }
      return accepted(config);
    };
    const user = userEvent.setup(); openPage();
    const input = await readyComposer();
    await user.type(input, "Keep my draft after conflict");
    await user.click(screen.getByRole("button", {name: "Enviar mensaje"}));
    await waitFor(() => expect(writes).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole("button", {name: "Enviar mensaje"})).toBeEnabled());
    expect(input).toHaveValue("Keep my draft after conflict");
    await user.click(screen.getByRole("button", {name: "Enviar mensaje"}));
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[0].body.expected_conversation_revision).toBe(1);
    expect(writes[1].body.expected_conversation_revision).toBe(2);
    expect(writes[1].body.parts).toEqual(writes[0].body.parts);
  });

  it("keeps a foreign owner chat read-only even when the selection is available", async () => {
    current.conversation = {...current.conversation, owner_user_id: "10", read_only: true};
    openPage();
    expect(await screen.findByText("Solo lectura")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", {name: "Mensaje"})).not.toBeInTheDocument();
    expect(screen.queryByRole("button", {name: "Configuración"})).not.toBeInTheDocument();
    expect(screen.queryByRole("button", {name: "Conexión"})).not.toBeInTheDocument();
    expect(writes).toEqual([]);
  });

  it("blocks an unavailable exact selection without switching provider/model", async () => {
    available = false; openPage();
    await screen.findByRole("textbox", {name: "Mensaje"});
    await waitFor(() => expect(reads.some(entry => entry.url.endsWith("/eligibility"))).toBe(true));
    expect(screen.getByRole("button", {name: "Enviar mensaje"})).toBeDisabled();
    expect(screen.getByRole("textbox", {name: "Mensaje"})).toBeDisabled();
    expect(reads.filter(entry => entry.url.endsWith("/eligibility")).every(entry => entry.params.model_id === selection.model_id)).toBe(true);
    expect(writes).toEqual([]);
  });

  it("refreshes a busy observation once when the same turn finishes, preserving the next draft", async () => {
    const user = userEvent.setup(); openPage();
    const composer = await readyComposer();
    await user.type(composer, "Keep my next draft while the previous work completes");
    current.current_run = { ...run, state: "running" };
    available = false; eligibilityReason = "nodia_ai:runtime_busy";
    await act(() => client.invalidateQueries({ queryKey: ["nodia-ai", "9", 1, "detail", chatId] }));
    await act(() => client.invalidateQueries({ predicate: query => query.queryKey[3] === "eligibility" }));
    expect(await screen.findByText("La sesión está ocupada. Vuelve a comprobar cuando termine la operación.")).toBeInTheDocument();
    expect(composer).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Volver a comprobar" })).not.toBeInTheDocument();
    const before = reads.filter(entry => entry.url.endsWith("/eligibility")).length;
    available = true;
    current.current_run = { ...run, state: "completed", completed_at: conversation.created_at };
    await act(() => client.invalidateQueries({ queryKey: ["nodia-ai", "9", 1, "detail", chatId] }));
    await waitFor(() => expect(composer).toBeEnabled());
    expect(reads.filter(entry => entry.url.endsWith("/eligibility"))).toHaveLength(before + 1);
    expect(composer).toHaveValue("Keep my next draft while the previous work completes");
    expect(writes).toEqual([]);
  });

  it("preserves the next draft and composer node while a terminal profile waits for native acknowledgement", async () => {
    const user = userEvent.setup(); openPage();
    const composer = await readyComposer();
    await user.type(composer, "Keep this draft during native acknowledgement");
    current.current_run = { ...run, state: "running" };
    await act(() => client.invalidateQueries({ queryKey: ["nodia-ai", "9", 1, "detail", chatId] }));
    await screen.findByText("NodiaAI está trabajando");
    available = false; eligibilityReason = "nodia_ai:runtime_busy";
    current.current_run = { ...run, state: "completed", completed_at: conversation.created_at };
    await act(() => client.invalidateQueries({ queryKey: ["nodia-ai", "9", 1, "detail", chatId] }));
    await screen.findByText("La sesión está ocupada. Vuelve a comprobar cuando termine la operación.");
    expect(composer).toBeDisabled();
    expect(composer).toHaveValue("Keep this draft during native acknowledgement");
    available = true;
    await waitFor(() => expect(composer).toBeEnabled(), { timeout: 2500 });
    expect(screen.getByRole("textbox", { name: "Mensaje" })).toBe(composer);
    expect(composer).toHaveValue("Keep this draft during native acknowledgement");
    expect(writes).toEqual([]);
  });

  it("recovers a busy selection after reopening through one explicit GET without changing its configuration", async () => {
    current.current_run = { ...run, state: "completed", completed_at: conversation.created_at };
    available = false; eligibilityReason = "nodia_ai:runtime_busy";
    const user = userEvent.setup(); openPage();
    await screen.findByText("La sesión está ocupada. Vuelve a comprobar cuando termine la operación.");
    expect(screen.getByRole("textbox", { name: "Mensaje" })).toBeDisabled();
    const before = reads.filter(entry => entry.url.endsWith("/eligibility")).length;
    available = true;
    await user.click(screen.getByRole("button", { name: "Volver a comprobar" }));
    await readyComposer();
    expect(reads.filter(entry => entry.url.endsWith("/eligibility"))).toHaveLength(before + 1);
    expect(reads.filter(entry => entry.url.endsWith("/eligibility")).every(entry => entry.params.model_id === selection.model_id)).toBe(true);
    expect(writes).toEqual([]);
  });

  it("offers the translated alert action and prevents duplicate checks while a persistent rejection is pending", async () => {
    available = false; eligibilityReason = "private-provider-text-that-must-not-be-rendered";
    const user = userEvent.setup(); openPage();
    await screen.findByText("Configura una selección disponible antes de enviar mensajes.");
    const label = i18n.t("nodiaAi:configuration.check_again");
    const retry = screen.getByRole("button", { name: label });
    await waitFor(() => expect(retry).toBeEnabled());
    const alert = retry.closest('[role="alert"]');
    expect(alert?.querySelector(".MuiAlert-action")).toContainElement(retry);
    expect(alert?.querySelector(".MuiAlert-message")).not.toContainElement(retry);
    await user.hover(retry);
    expect(await screen.findByRole("tooltip", { name: label })).toBeInTheDocument();
    await user.unhover(retry);
    const composer = screen.getByRole("textbox", { name: "Mensaje" });
    const base = mainInstance.defaults.adapter;
    if (typeof base !== "function") throw new Error("Missing synthetic adapter");
    let checksStarted = 0;
    let completeCheck: (() => void) | undefined;
    mainInstance.defaults.adapter = async config => {
      if (config.url?.endsWith("/eligibility")) {
        checksStarted += 1;
        await new Promise<void>(resolve => { completeCheck = resolve; });
      }
      return base(config);
    };
    await user.dblClick(retry);
    await waitFor(() => expect(retry).toBeDisabled());
    expect(checksStarted).toBe(1);
    expect(retry.closest('[role="alert"]')).toBe(alert);
    expect(screen.getByRole("textbox", { name: "Mensaje" })).toBe(composer);
    await act(async () => { completeCheck?.(); });
    await waitFor(() => expect(retry).toBeEnabled());
    expect(screen.queryByText(eligibilityReason)).not.toBeInTheDocument();
    expect(composer).toBeDisabled();
    expect(reads.filter(entry => entry.url.endsWith("/eligibility"))).toHaveLength(2);
    expect(writes).toEqual([]);
  });

  it("blocks a previously available selection when its recheck fails, preserving the draft for explicit recovery", async () => {
    const user = userEvent.setup(); openPage();
    const composer = await readyComposer();
    await user.type(composer, "Keep my draft after availability fails");
    const base = mainInstance.defaults.adapter;
    if (typeof base !== "function") throw new Error("Missing synthetic adapter");
    let failing = true;
    mainInstance.defaults.adapter = async config => config.url?.endsWith("/eligibility") && failing
      ? rejected(config, 503, "Synthetic unavailable service") : base(config);
    await act(() => client.invalidateQueries({ predicate: query => query.queryKey[3] === "eligibility" }));
    await screen.findByText("No pudimos comprobar la disponibilidad de esta selección.");
    expect(composer).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enviar mensaje" })).toBeDisabled();
    expect(composer).toHaveValue("Keep my draft after availability fails");
    failing = false;
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(composer).toBeEnabled());
    expect(composer).toHaveValue("Keep my draft after availability fails");
    expect(writes).toEqual([]);
  });

  it("shows unknown reconciliation and blocks a new turn while allowing status reads", async () => {
    current.current_run = {...run, state: "unknown"}; openPage();
    expect(await screen.findByText("Resultado pendiente de conciliación")).toBeInTheDocument();
    expect(screen.getByRole("button", {name: "Enviar mensaje"})).toBeDisabled();
    const before = reads.filter(entry => entry.url === `/nodia-ai/conversations/${chatId}`).length;
    await userEvent.click(screen.getByRole("button", {name: "Actualizar estado"}));
    await waitFor(() => expect(reads.filter(entry => entry.url === `/nodia-ai/conversations/${chatId}`).length).toBeGreaterThan(before));
    expect(writes).toEqual([]);
  });

  it("recovers cached content after a refetch failure without automatically admitting a message", async () => {
    messageItems = [{message_id: messageId, run_id: null, seq: "2", role: "assistant", status: "sealed", created_at: conversation.created_at, visibility: "visible", author_user_id: null, sealed_at: conversation.created_at, parts: [{kind: "text", text: "Existing synthetic content"}]}];
    openPage(); await readyComposer();
    const firstAdapter = mainInstance.defaults.adapter;
    if (typeof firstAdapter !== "function") throw new Error("Missing synthetic test adapter");
    mainInstance.defaults.adapter = async config => config.url?.endsWith("/messages") ? rejected(config, 503, "Synthetic offline") : firstAdapter(config);
    await act(() => client.invalidateQueries({queryKey: ["nodia-ai", "9", 1, "messages", chatId]}));
    expect(screen.getByText("Existing synthetic content")).toBeInTheDocument();
    expect(await screen.findByText("No pudimos recuperar el historial. Los mensajes ya cargados se conservan.")).toBeInTheDocument();
    expect(writes).toEqual([]);
  });

  it("does not apply another chat's configuration after browser navigation during a pending selection save", async () => {
    let completeSelection: (() => void) | undefined;
    patchAction = config => new Promise(resolve => {
      completeSelection = () => {
        const body = JSON.parse(config.data as string) as {selection: NodiaAiSelection};
        current.conversation = {...current.conversation, revision: 2, selection: body.selection};
        resolve(response(config, current.conversation));
      };
    });
    const user = userEvent.setup(); openPage(); await readyComposer();
    await waitFor(() => expect(screen.getByRole("button", {name: "Modelo"})).not.toHaveAttribute("aria-disabled", "true"));
    await user.click(screen.getByRole("button", {name: "Modelo"}));
    await user.click(await screen.findByRole("option", {name: "Second Agentic model"}));
    await user.click(screen.getByRole("button", {name: "Aplicar configuración"}));
    await waitFor(() => expect(writes).toHaveLength(1));
    await act(() => navigate(`/nodia-ai?chat=${otherChatId}`));
    expect(await screen.findByRole("heading", {name: "Other synthetic chat"})).toBeInTheDocument();
    await act(async () => { completeSelection?.(); });
    await waitFor(() => expect(screen.getByRole("button", {name: "Conexión"})).toBeEnabled());
    expect(screen.getByRole("button", {name: "Modelo"})).toHaveTextContent(model.label);
    expect(writes).toHaveLength(1);
    expect(writes[0].url).toBe(`/nodia-ai/conversations/${chatId}/selection`);
    expect(screen.queryByRole("dialog", {name: "Configuración del chat"})).not.toBeInTheDocument();
  });

  it("restores uncertain-send recovery when returning to the chat through browser history", async () => {
    admitAction = config => { throw new AxiosError("Synthetic timeout", "ECONNABORTED", config); };
    const user = userEvent.setup(); openPage();
    await user.type(await readyComposer(), "Original pending content");
    await user.click(screen.getByRole("button", {name: "Enviar mensaje"}));
    const recover = await screen.findByRole("button", {name: "Comprobar el mismo envío"});
    await waitFor(() => expect(recover).toBeEnabled());
    await user.click(screen.getByRole("button", {name: "Conversaciones"}));
    await user.click(await screen.findByRole("button", {name: /^Other synthetic chat/}));
    await screen.findByRole("heading", {name: "Other synthetic chat"});
    await act(() => navigate(-1));
    expect(await screen.findByRole("button", {name: "Comprobar el mismo envío"})).toBeInTheDocument();
    const input = screen.getByRole("textbox", {name: "Mensaje"});
    expect(input).toHaveValue("Original pending content");
    expect(input).toBeDisabled();
    expect(writes).toHaveLength(1);
  });

  it("reads the final answer after a confirmed admission whose status refetch initially failed", async () => {
    const firstAdapter = mainInstance.defaults.adapter;
    if (typeof firstAdapter !== "function") throw new Error("Missing synthetic test adapter");
    let failStatus = true;
    mainInstance.defaults.adapter = async config => config.method === "get" && config.url === `/nodia-ai/conversations/${chatId}` && writes.length > 0 && failStatus
      ? rejected(config, 503, "Synthetic status offline") : firstAdapter(config);
    const user = userEvent.setup(); openPage();
    await user.type(await readyComposer(), "Confirmed admission with interrupted observation");
    await user.click(screen.getByRole("button", {name: "Enviar mensaje"}));
    expect(await screen.findByText("No pudimos recuperar este chat. Puede haber expirado o ya no estar autorizado.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("textbox", {name: "Mensaje"})).toHaveValue(""));
    expect(screen.queryByRole("button", {name: "Comprobar el mismo envío"})).not.toBeInTheDocument();
    const assistantId = "55555555-5555-4555-8555-555555555555";
    current.current_run = {...run, state: "completed", assistant_message_id: assistantId, completed_at: conversation.created_at, revision: 2};
    messageItems = [{message_id: assistantId, run_id: null, seq: "2", role: "assistant", status: "sealed", created_at: conversation.created_at, visibility: "visible", author_user_id: null, sealed_at: conversation.created_at, parts: [{kind: "text", text: "Answer sealed while the status observer was offline"}]}];
    failStatus = false;
    await user.click(screen.getByRole("button", {name: "Reintentar"}));
    expect(await screen.findByText("Answer sealed while the status observer was offline")).toBeInTheDocument();
    expect(writes).toHaveLength(1);
  });
});
