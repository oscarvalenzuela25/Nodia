// Isolated synthetic AI-35 harness. No production route imports this module.
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { AxiosError } from "axios";
import type { AxiosResponse } from "axios";
import { Box, Button, Typography } from "@mui/material";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "sileo/styles.css";
import "../../../styles/main.css";
import MUIProvider from "../../../providers/MUIProvider";
import { PageContent } from "../../../layouts/BaseLayout/styles";
import NodiaAI from "../../../modules/nodiaAi/pages/NodiaAI";
import type { NodiaAiConversation, NodiaAiEvent, NodiaAiMessagePage, NodiaAiPage } from "../../../modules/nodiaAi/infrastructure/types";
import { mainInstance } from "../../../config/api";
import { queryClient } from "../../../config/reactQuery";
import useAuthStore from "../../../store/authStore";
import useThemeStore from "../../../store/configStore";
import useGeneralSettingsStore from "../../../store/generalSettings/generalSettingsStore";
import i18n from "../../../translate";
import { CHAT_ID, WEB_SELECTION, installFixture } from "../nodia-ai/fixtures";
import { run as syntheticRun, conversation as syntheticConversation } from "../../modules/nodiaAi/infrastructure/fixtures";
import { proposalEvent, readonlyReview } from "../../modules/nodiaAi/infrastructure/proposalFixtures";
import { report } from "../../modules/nodiaAi/infrastructure/reportFixtures";
import { partialWorkflow, workflowProposal } from "../../modules/nodiaAi/infrastructure/workflowFixtures";
import { nodiaAiExecutionSchema, nodiaAiProposalSchema, nodiaAiProposalReviewSchema } from "../../../modules/nodiaAi/infrastructure/schemas";

if (location.origin !== "http://127.0.0.1:5199") throw new Error("AI-35 synthetic QA requires isolated http://127.0.0.1:5199");
const params = new URLSearchParams(location.search);
const scenario = params.get("scenario") ?? "rich";
const stepsScenario = scenario === "steps" || scenario === "steps-unknown";
const olderScenario = scenario === "older" || scenario === "historical-older";
await i18n.changeLanguage(params.get("lang") === "en" ? "en" : "es");
document.documentElement.lang = i18n.language;
useThemeStore.setState({ themeType: params.get("theme") === "light" ? "light" : "dark" });
// Prevent the synthetic recording control from ever accessing a physical mic.
Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: () => Promise.reject(new DOMException("Synthetic QA forbids microphone capture", "NotAllowedError")) } });
const owner = "90000000991";
const base = installFixture(stepsScenario ? "workflow-partial" : "confirmation");
// Explicitly bind the receipt, immutable confirmed proposal and review metadata.
// A partially completed execution is terminal and is not active_execution.
const stepExecution = nodiaAiExecutionSchema.parse(scenario === "steps-unknown" ? { ...partialWorkflow, state: "unknown", can_resume: false,
  steps: partialWorkflow.steps.map((step, index) => index === 0 ? step : { ...step, state: "unknown", error: null }),
} : structuredClone(partialWorkflow));
const stepProposal = nodiaAiProposalSchema.parse({ ...structuredClone(workflowProposal), state: "confirmed", execution_id: stepExecution.execution_id });
const stepReview = nodiaAiProposalReviewSchema.parse({ ...readonlyReview, proposal_id: stepProposal.proposal_id, revision: stepProposal.revision, hash: stepProposal.hash });
const counts = { reads: 0, mutations: 0, blocked: 0, last: "", detail: "ok", patch: "ok" };
const requests: { method: string; path: string }[] = [];
let detailFailure: 403 | 500 | null = null;
let patchFailure: 409 | 503 | null = null;
let catalogFailure = false;
const rows: NodiaAiConversation[] = Array.from({ length: 28 }, (_, index) => ({ ...syntheticConversation,
  conversation_id: index === 0 ? CHAT_ID : `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  owner_user_id: index === 4 ? "90000000992" : owner,
  title: index === 0 ? "[QA] Negocios, Reservas y Finanzas · conversación con un título largo para comprobar el ajuste" : index % 2 ? `[QA] Reservas ${index + 1}` : `[QA] Finanzas ${index + 1}`,
  is_pinned: index === 2, is_archived: index >= 24, selection: WEB_SELECTION,
  read_only: index === 4,
}));
const run = { ...syntheticRun, conversation_id: CHAT_ID, selection: WEB_SELECTION, state: scenario === "unknown" ? "unknown" as const : "completed" as const, completed_at: scenario === "unknown" ? null : syntheticConversation.updated_at };
const attachmentId = "80000000-0000-4000-8000-000000000001";
const reportRef = { tool_call_id: "80000000-0000-4000-8000-000000000002", tool_name: "nodia_reports_run", contract_hash: "a".repeat(64) };
const eventBase = { ...proposalEvent, conversation_id: CHAT_ID, run_id: run.run_id };
const events: NodiaAiEvent[] = [{ ...eventBase }, { ...eventBase, event_id: "80000000-0000-4000-8000-000000000003", seq: "3", cursor: "synthetic-report", kind: "tool_completed", payload: { result_ref: reportRef, state: "completed", error: null } }];
const messages: NodiaAiMessagePage = { conversation_id: CHAT_ID, next_cursor: olderScenario ? "ai35-older" : null, items: [
  { message_id: "80000000-0000-4000-8000-000000000004", run_id: null, seq: olderScenario ? "11" : "1", role: "user", status: "sealed", visibility: "visible", author_user_id: owner, created_at: syntheticConversation.created_at, sealed_at: syntheticConversation.created_at,
    parts: [{ kind: "text", text: "[QA SINTÉTICO] Consulta combinada de Negocios, Reservas y Finanzas. Ninguna solicitud sale del adaptador sintético." }, { kind: "pdf", attachment_id: attachmentId, text: "[QA] Documento sintético, sin archivo privado." }] },
  { message_id: "80000000-0000-4000-8000-000000000005", run_id: run.run_id, seq: olderScenario ? "12" : "2", role: "assistant", status: "partial", visibility: "visible", author_user_id: null, created_at: syntheticConversation.updated_at, sealed_at: syntheticConversation.updated_at,
    parts: [{ kind: "text", text: "[QA SYNTHETIC PARTIAL RESPONSE]\n" + "Texto sintético con información extensa que debe conservarse al revalidar, cambiar idioma o redimensionar. / Synthetic text retained on refetch and resize.\n".repeat(8) + "IdentificadorSintéticoMuyLargoSinEspacios".repeat(5) }] },
] };
const olderMessages: NodiaAiMessagePage = { conversation_id: CHAT_ID, next_cursor: null, items: Array.from({ length: 10 }, (_, index) => ({
  message_id: `90000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, run_id: null, seq: String(index + 1),
  role: index % 2 ? "assistant" : "user", status: "sealed", visibility: "visible" as const, author_user_id: index % 2 ? null : owner,
  created_at: syntheticConversation.created_at, sealed_at: syntheticConversation.created_at,
  parts: [{ kind: "text" as const, text: `[QA OLDER ${index + 1}]\n` + "Historial sintético previo, sólo lectura, para medir conservación de posición al anteponer una página. / Earlier synthetic history used to measure scroll anchoring.\n".repeat(6) }],
})) };
const paginationDiagnostic = { request_cursor: null as string | null, response_ids: [] as string[], cache_ids: [] as string[][], duplicate_ids: [] as string[] };
const display = () => { const node = document.getElementById("qa-ai35-counts"); if (node) { node.textContent = JSON.stringify(counts); node.dataset.pagination = JSON.stringify(paginationDiagnostic); } };
queryClient.getQueryCache().subscribe(event => {
  if (!("query" in event) || event.query.queryKey[0] !== "nodia-ai" || event.query.queryKey[3] !== "conversations") return;
  const data = queryClient.getQueryData<InfiniteData<NodiaAiPage<NodiaAiConversation>>>(event.query.queryKey);
  paginationDiagnostic.cache_ids = data?.pages.map(page => page.items.map(row => row.conversation_id)) ?? [];
  const seen = new Set<string>(), duplicates = new Set<string>();
  for (const id of paginationDiagnostic.cache_ids.flat()) { if (seen.has(id)) duplicates.add(id); seen.add(id); }
  paginationDiagnostic.duplicate_ids = [...duplicates]; display();
});
mainInstance.defaults.skipAuth = true;
mainInstance.defaults.adapter = async config => {
  const path = config.url ?? "", method = (config.method ?? "get").toUpperCase();
  requests.push({ method, path }); counts.last = `${method} ${path}`;
  if (method === "GET") counts.reads++; else counts.mutations++;
  display();
  const response = (data: unknown, status = 200): AxiosResponse => ({ config, data, status, statusText: status === 200 ? "OK" : "Synthetic failure", headers: {} });
  const fail = (status: number, code: string): never => { throw new AxiosError(code, "ERR_BAD_RESPONSE", config, undefined, response({ message: code }, status)); };
  const body = typeof config.data === "string" ? JSON.parse(config.data) as Record<string, unknown> : {};
  if (method === "GET" && path === "/nodia-ai/conversations") {
    const filter = config.params ?? {}, search = String(filter.search ?? "").toLocaleLowerCase();
    const filtered = rows.filter(row => (filter.view === "all" || row.owner_user_id === owner) && (!search || row.title?.toLocaleLowerCase().includes(search))
      && (filter.is_archived === undefined || row.is_archived === filter.is_archived) && (filter.is_pinned === undefined || row.is_pinned === filter.is_pinned));
    const offset = Number(filter.cursor ?? 0), page = filtered.slice(offset, offset + 8);
    paginationDiagnostic.request_cursor = filter.cursor === undefined ? null : String(filter.cursor);
    paginationDiagnostic.response_ids = page.map(row => row.conversation_id); display();
    return response({ items: page, next_cursor: offset + 8 < filtered.length ? String(offset + 8) : null });
  }
  const chatMatch = /^\/nodia-ai\/conversations\/([a-f0-9-]+)$/.exec(path);
  if (chatMatch) {
    const row = rows.find(item => item.conversation_id === chatMatch[1]);
    if (!row) return fail(404, "Synthetic conversation missing");
    if (method === "GET") {
      if (detailFailure) return fail(detailFailure, `Synthetic detail ${detailFailure}`);
      return response({ conversation: row, current_run: row.conversation_id === CHAT_ID && !["historical", "historical-older"].includes(scenario) ? run : null,
        active_execution: row.conversation_id === CHAT_ID && scenario === "steps-unknown" ? stepExecution : null });
    }
    if (method === "PATCH") {
      const rejection = patchFailure; patchFailure = null; counts.patch = "ok"; display();
      if (rejection) return fail(rejection, rejection === 409 ? "nodia_ai:revision_conflict" : "Synthetic PATCH unavailable; preserve modal and draft");
      if (body.expected_conversation_revision !== row.revision) return fail(409, "nodia_ai:revision_conflict");
      if (body.title !== undefined) row.title = body.title as string | null;
      if (typeof body.is_pinned === "boolean") row.is_pinned = body.is_pinned;
      if (typeof body.is_archived === "boolean") row.is_archived = body.is_archived;
      row.revision++; return response({ ...row });
    }
  }
  if (method === "GET" && /^\/nodia-ai\/conversations\/[a-f0-9-]+\/messages$/.test(path)) {
    const id = path.split("/")[3]; return response(id === CHAT_ID ? olderScenario && config.params?.cursor === "ai35-older" ? olderMessages : messages : { conversation_id: id, items: [], next_cursor: null });
  }
  if (method === "GET" && path === `/nodia-ai/runs/${run.run_id}`) return response(run);
  if (method === "GET" && path === `/nodia-ai/runs/${run.run_id}/events`) return response({ conversation_id: CHAT_ID, items: events, next_cursor: "synthetic-ai35-events", cursor_state: "current", has_more: false });
  if (stepsScenario && method === "GET" && path === `/nodia-ai/proposals/${stepProposal.proposal_id}`) {
    if (config.params?.revision !== undefined && config.params.revision !== stepProposal.revision) return fail(404, "Synthetic immutable revision unavailable");
    return response(stepProposal);
  }
  if (stepsScenario && method === "GET" && path === `/nodia-ai/proposals/${stepProposal.proposal_id}/review-metadata`) return response(stepReview);
  if (stepsScenario && method === "GET" && path === `/nodia-ai/operations/${stepExecution.execution_id}`) return response(stepExecution);
  if (method === "GET" && path === `/nodia-ai/tool-calls/${reportRef.tool_call_id}/result`) return response(report);
  if (method === "GET" && path === `/nodia-ai/attachments/${attachmentId}`) return response({ attachment_id: attachmentId, conversation_id: CHAT_ID, kind: "pdf", state: "ready", media_type: "application/pdf", byte_count: 0,
    file_name: "[QA] Comprobante sintético de Negocios Reservas y Finanzas con nombre largo para comprobar ajuste.pdf", page_count: 1, duration_seconds: null, interpretation: null });
  if (method === "GET" && path === `/nodia-ai/attachments/${attachmentId}/content`) return response(new Blob(["Synthetic QA content only"], { type: "text/plain" }));
  if (method === "GET" && path === "/nodia-ai/attachments/capabilities") return response({ limits: { file_bytes: 20971520, files_per_message: 4, message_files_bytes: 41943040, audio_seconds: 300, pdf_pages: 50, image_pixels: 40000000 }, reviewed_text: true, native_modalities: { image: null, pdf: null, audio: null }, native_media_types: [] });
  if (method === "GET" && path === "/nodia-ai/preferences") return response({ items: [], next_cursor: null });
  if (method === "GET" && path === "/nodia-ai/preferences/catalog") return response({ items: [] });
  if (method === "GET" && path === "/nodia-ai/connections" && catalogFailure) { catalogFailure = false; return fail(503, "Synthetic catalog unavailable"); }
  if (method === "GET" && (path === "/nodia-ai/connections" || /^\/nodia-ai\/connections\/\d+\/eligibility$/.test(path) || /^\/nodia-ai\/proposals\/[a-f0-9-]+(?:\/review-metadata)?$/.test(path) || /^\/nodia-ai\/operations\/[a-f0-9-]+$/.test(path))) return base.adapter(config);
  if (method === "PATCH" && /^\/nodia-ai\/proposals\/[a-f0-9-]+$/.test(path)) return base.adapter(config);
  counts.blocked++; display(); return fail(400, `AI35 synthetic fixture blocks ${method} ${path}`);
};
useAuthStore.getState().login({ token: "synthetic-ai35-only-not-a-real-credential", user: { id: owner, name: "Synthetic QA" }, expiresAt: Date.now() + 3600000 });
useGeneralSettingsStore.setState({ isLoaded: true, roles: ["super_admin"], modules: [], actions: [] });
const refresh = () => void queryClient.invalidateQueries({ queryKey: ["nodia-ai"] });
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[`/tools/nodia-ai?chat=${CHAT_ID}`]}><MUIProvider>
  <Box component="aside" aria-label="AI35 synthetic controls" sx={{ p: 2, display: "flex", flexWrap: "wrap", gap: 1, minWidth: 0 }}>
    <Typography sx={{ width: "100%" }}>QA SINTÉTICO AI-35 · SIN BD / PROVEEDOR / MICRÓFONO</Typography>
    <Button onClick={() => { detailFailure = 403; counts.detail = "403"; display(); refresh(); }}>Detail 403</Button>
    <Button onClick={() => { detailFailure = 500; counts.detail = "500"; display(); refresh(); }}>Detail 500</Button>
    <Button onClick={() => { detailFailure = null; counts.detail = "ok"; display(); refresh(); }}>Detail OK</Button>
    <Button onClick={() => { patchFailure = 503; counts.patch = "503 next"; display(); }}>Next PATCH 503</Button>
    <Button onClick={() => { patchFailure = 409; counts.patch = "409 next"; display(); }}>Next PATCH 409</Button>
    <Button onClick={() => { rows[0].revision++; display(); }}>Bump CAS</Button>
    <Button onClick={() => { catalogFailure = true; }}>Next catalog 503</Button>
    <Button onClick={refresh}>Refetch</Button>
    <output id="qa-ai35-counts" aria-label="Synthetic mutation counts" style={{ width: "100%", overflowWrap: "anywhere" }}>{JSON.stringify(counts)}</output>
  </Box><PageContent><NodiaAI /></PageContent></MUIProvider></MemoryRouter></QueryClientProvider>);
