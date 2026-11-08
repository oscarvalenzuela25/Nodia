// Synthetic UI-only QA. No provider, operational database or real HTTP is used.
import { createRoot } from "react-dom/client";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/700.css";
import "@fontsource/dm-sans/300.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/700.css";
import "sileo/styles.css";
import "../../../styles/main.css";
import MUIProvider from "../../../providers/MUIProvider";
import { PageContent } from "../../../layouts/BaseLayout/styles";
import Teacher from "../../../modules/teacher/pages/Teacher";
import useAuthStore from "../../../store/authStore";
import config from "../../../store/configStore";
import { mainInstance } from "../../../config/api";
import i18n from "../../../translate";
import type { Answer, Session, Outline, Question, Attempt } from "../../../modules/teacher/infrastructure/schemas";

const params = new URLSearchParams(location.search);
const realHttp = params.get("realHttp");
if (realHttp && !["127.0.0.1", "localhost"].includes(new URL(realHttp).hostname)) throw new Error("Teacher QA accepts only an explicitly supplied disposable loopback Server");
const lang = params.get("lang") === "en" ? "en" : "es";
await i18n.changeLanguage(lang);
document.documentElement.lang = lang;
config.setState({ themeType: params.get("theme") === "dark" ? "dark" : "light" });
useAuthStore.getState().login({ token: "synthetic-never-sent", expiresAt: Date.now() + 3_600_000, user: { id: realHttp ? params.get("actorId") ?? "1" : "teacher-qa", name: "QA" } });
const scenario = params.get("scenario") ?? "list";
const id = "11111111-1111-4111-8111-111111111111";
const pid = "22222222-2222-4222-8222-222222222222";
const sid = "33333333-3333-4333-8333-333333333333";
const uid = "44444444-4444-4444-8444-444444444444";
const aid = "55555555-5555-4555-8555-555555555555";
const oid = "66666666-6666-4666-8666-666666666666";
const cid = "77777777-7777-4777-8777-777777777777";
const jobId = "88888888-8888-4888-8888-888888888888";
const english = params.get("topic") === "english";
const topic = english ? "English for everyday technical conversations" : "Redes e Internet";
const objective = english ? "Explain a problem clearly and ask for help in everyday and work contexts." : "Comprender cómo se conectan los dispositivos y resolver problemas cotidianos de conectividad.";
const actions = (...keys: string[]) => Object.fromEntries(keys.map(key => [key, { enabled: true, reason_code: null }]));
const outline: Outline = { schema_version: 1, title: topic, topic, objective, explanation_language: lang, organization: english ? "days" : "topics", day_count: english ? 7 : null, sections: [{ id: sid, title: english ? "Explaining a problem" : "Cómo funciona Internet", required: true, prerequisite_section_ids: [], objectives: [{ id: oid, description: objective }], units: [{ id: uid, title: english ? "Asking for help" : "Nombres, direcciones y DNS", objective_ids: [oid], day_start: english ? 1 : null, day_end: english ? 2 : null }] }], assessment_policy: { version: "teacher-assessment/1", practice_counts: { single_choice: 3, completion: 1, short_text: 1 }, final_counts: { single_choice: 6, completion: 2, short_text: 4 }, diagnostic_counts: { single_choice: 4, completion: 2, short_text: 2 }, final_threshold_percent: 90, coverage_per_objective: 2, criterion_ids: ["objective", "accuracy", "clarity"], normalization: "NFC-trim-collapse" } };
const hasPlan = !["draft", "review"].includes(scenario);
const isAttempt = ["final", "graded", "failed", "practice"].includes(scenario);
const session: Session = { setup_draft_text: "", setup_draft_revision: 0, id, title: topic, topic, objective, state: scenario === "paused" ? "paused" : hasPlan ? "active" : "draft", revision: 1, updated_at: new Date().toISOString(), declared_base: null, context: null, explanation_language: lang, requested_organization: outline.organization, requested_day_count: outline.day_count, selection: { connection_id: "1", mode: "api_key", model_id: "qa-synthetic-teacher-model", effort_id: null }, dispatch_limit: 200, dispatches_used: 2, current_plan: hasPlan ? { id: pid, revision_no: 1, outline, content_hash: "a".repeat(64), state: "accepted" } : null, latest_proposal: scenario === "review" ? { id: pid, revision_no: 1, outline, content_hash: "a".repeat(64), state: "draft" } : null, latest_job_id: scenario === "unknown" ? jobId : null, active_jobs: scenario === "unknown" ? [{ job_id: jobId, state: "unknown", purpose: "learning_packet" }] : [], active_attempts: [], section_states: [{ section_id: sid, verification_state: "not_verified", allowed_actions: actions("start_final", "retry_final") }], cursor: { revision: 1, phase: isAttempt ? "final" : hasPlan && scenario !== "plan" ? "theory" : "setup", plan_revision_id: hasPlan ? pid : null, section_id: hasPlan ? sid : null, unit_id: isAttempt || scenario === "plan" ? null : uid, content_version_id: isAttempt || scenario === "plan" ? null : cid, attempt_id: isAttempt ? aid : null, item_id: isAttempt ? "q0" : null, block_id: null }, allowed_actions: actions("edit", "propose_plan", "accept_plan", "prepare_unit", "start_section_final", "pause", "archive", "start_diagnostic") };
if (session.state === "paused") session.allowed_actions = actions("resume", "archive");
const delivered = scenario === "graded" || scenario === "failed";
const attempt: Attempt = { attempt_id: aid, session_id: id, scope: scenario === "practice" ? "unit_practice" : "section_final", state: delivered ? "graded" : "in_progress", result: delivered ? scenario === "failed" ? "not_passed" : "passed" : scenario === "practice" ? null : "pending", revision: 1, plan_revision_id: pid, section_id: sid, unit_id: scenario === "practice" ? uid : null, questions: Array.from({ length: 12 }, (_, index) => ({ question_id: `q${index}`, ordinal: index + 1, answer_status: delivered ? "submitted" : "empty" })), ...(delivered ? { earned_points: scenario === "failed" ? 32 : 36, denominator_points: 40, percentage: scenario === "failed" ? 80 : 90 } : {}), allowed_actions: delivered ? actions("view_feedback", "new_attempt") : actions("save_answers", "submit_attempt", "request_help", ...(scenario === "practice" ? ["submit_question"] : [])) };
const responses = new Map<string, { answer: Answer | null; revision: number }>();
const receiptMap = new Map<string, unknown>();
const calls: { method: string; path: string; body: unknown }[] = [];
Object.assign(window, { teacherQA: { calls, session, responses } });
let failed = false;
if (realHttp) mainInstance.defaults.baseURL = realHttp;
else mainInstance.defaults.adapter = async request => {
  await new Promise<void>(resolve => setTimeout(resolve, 80));
  const path = request.url?.replace(/^\/teacher\//, "") ?? "";
  const body = request.data ? JSON.parse(String(request.data)) as Record<string, unknown> : {};
  calls.push({ method: request.method ?? "get", path, body });
  const response = (data: unknown, status = 200) => ({ config: request, data: structuredClone(data), status, statusText: "QA", headers: {} });
  const reject = (status: number, message: string): never => { throw new AxiosError(message, "ERR_BAD_RESPONSE", request, undefined, response({ message }, status)); };
  if (request.method === "get") {
    if (scenario === "error" && path === "sessions") reject(503, "teacher:provider_unavailable");
    if (path === "connections") return response({ items: [{ connection_id: "1", label: "Synthetic QA connection", is_active: true, modes: [{ mode: "api_key", configuration: "configured", configured_selection: session.selection, models: [{ model_id: "qa-synthetic-teacher-model", label: "Synthetic QA model", efforts: [] }] }] }], next_cursor: null });
    if (path.includes("/eligibility")) return response({ eligible: false, reason_code: "adapter_unqualified", checked_at: null, selection: session.selection });
    if (path === "sessions") return response({ data: scenario === "empty" ? [] : [session], meta: { page: 1, limit: 10, total_items: scenario === "empty" ? 0 : 1, total_pages: 1 } });
    if (path === `sessions/${id}`) return response(session);
    if (path.endsWith("/messages")) return response({ data: [{ id: "m1", role: "assistant", text: english ? "Would you like to organize this by study days or topics?" : "¿Prefieres organizar tu plan por jornadas o por tópicos?" }], meta: { page: 1, limit: 50, total_items: 1, total_pages: 1 } });
    if (path.includes("plan-proposals")) return response(session.latest_proposal);
    if (path === `jobs/${jobId}`) return response({ job_id: jobId, fence: "1", state: "unknown", purpose: "learning_packet", result_ref: null, error_code: null, local_closed: true, remote_outcome: "unknown", retry_after_ms: null, allowed_actions: actions("refresh", "request_new_generation") });
    if (path.includes("/questions/")) {
      const qid = path.split("/").at(-1)!;
      const stored = responses.get(qid);
      const question: Question = { question_id: qid, kind: "single_choice", prompt: english ? "Which phrase asks for clarification politely?" : "¿Qué servicio transforma un nombre de dominio en una dirección IP?", options: english ? [{ id: "a", label: "Could you explain that again, please?" }, { id: "b", label: "It works yesterday." }] : [{ id: "a", label: "DNS" }, { id: "b", label: "SMTP" }], response_id: `r-${qid}`, response_revision: stored?.revision ?? 1, draft_answer: stored?.answer ?? null, ...(delivered ? { frozen_answer: stored?.answer ?? { kind: "single_choice", option_id: "a" }, feedback: { correct_answer: { kind: "single_choice", option_id: "a" }, explanation: english ? "A polite clarification question makes the missing information explicit." : "DNS resuelve nombres legibles a direcciones que la red puede enrutar.", earned_points: 2, max_points: 2 } } : {}) };
      return response(question);
    }
    if (path.includes("/attempts/")) return response(attempt);
    if (path.includes("/units/")) return response({ kind: "material", resource_id: cid, content_version_id: cid, plan_revision_id: pid, unit_id: uid, blocks: [{ id: "b1", kind: "explanation", title: english ? "Ask for the information you need" : "De un nombre a una dirección", body_markdown: english ? "Start with what you understood, then ask a specific clarification question.\n\n**Example:** Could you explain what happens after I click Save?" : "Una dirección IP identifica un destino en una red. Un nombre de dominio ofrece una etiqueta fácil de recordar.\n\n**DNS** permite resolver ese nombre a una dirección. La resolución y la conexión son pasos distintos." }, { id: "b2", kind: "example", title: english ? "Use a concrete example" : "Sigue el recorrido", body_markdown: english ? "Explain the observed behavior before requesting help. This makes your question easier to answer." : "Al abrir un sitio, primero se consulta su dirección y después se establece la conexión. Que la consulta responda no demuestra que el servicio esté disponible." }, { id: "b3", kind: "guided_practice", title: english ? "Practice" : "Práctica guiada", body_markdown: english ? "Write a question asking a colleague to repeat the last step." : "Describe qué comprobarías si un dispositivo llega a una IP, pero no resuelve el nombre del sitio." }], allowed_actions: actions("read_theory", "start_practice") });
    if (path.startsWith("requests/")) { const key = path.split("/")[1]; const receipt = receiptMap.get(key); if (!receipt) reject(404, "teacher:not_found"); return response(receipt); }
    return reject(404, "teacher:not_found");
  }
  if (params.get("fail") === "pause" && path.endsWith("/pause") && !failed) { failed = true; return reject(409, "teacher:revision_conflict"); }
  const key = String(request.headers.get("Idempotency-Key"));
  let result: Record<string, unknown> = { session_id: id, revision: ++session.revision };
  if (path === "sessions") result = { session_id: id, revision: session.revision };
  if (path.endsWith("/cursor")) { session.cursor = { ...session.cursor, ...body, revision: session.cursor.revision + 1 }; result = { session_id: id, revision: session.cursor.revision }; }
  if (path.endsWith("/responses")) { for (const patch of body.responses as { question_id: string; answer: Answer }[]) responses.set(patch.question_id, { answer: patch.answer, revision: (responses.get(patch.question_id)?.revision ?? 1) + 1 }); attempt.revision++; result = { attempt_id: aid, revision: attempt.revision, responses: (body.responses as { question_id: string }[]).map(patch => ({ question_id: patch.question_id, response_revision: responses.get(patch.question_id)!.revision })) }; }
  if (path.endsWith("/pause")) { if (body.pending_responses) { for (const patch of body.pending_responses as { question_id: string; answer: Answer }[]) responses.set(patch.question_id, { answer: patch.answer, revision: (responses.get(patch.question_id)?.revision ?? 1) + 1 }); attempt.revision++; } session.state = "paused"; session.cursor = { ...session.cursor, ...(body.cursor as object), revision: session.cursor.revision + 1 }; session.allowed_actions = actions("resume", "archive"); }
  if (path.endsWith("/resume")) { session.state = "active"; session.allowed_actions = actions("pause", "archive", "start_section_final"); }
  if (path.endsWith("/attempts")) result = { attempt_id: aid, kind: "attempt", revision: attempt.revision };
  if (path.endsWith("/help")) result = { attempt_id: aid, revision: ++attempt.revision, hint: english ? "Ask one concrete question." : "Distingue la resolución del nombre de la conexión al destino." };
  if (path.endsWith("/accept")) session.current_plan = { id: pid, revision_no: 1, outline, content_hash: "a".repeat(64), state: "accepted" };
  receiptMap.set(key, { request_key: key, operation: path, session_id: id, http_status: 200, receipt: result, completed_at: new Date().toISOString() });
  if (params.get("fail") === "lost" && !failed) { failed = true; throw new AxiosError("synthetic lost response", "ERR_NETWORK", request); }
  return response(result);
};
const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
const initialEntry = realHttp ? params.get("sessionId") ? `/nodia-teacher/${params.get("sessionId")}` : "/nodia-teacher" : ["list", "empty", "error"].includes(scenario) ? "/nodia-teacher" : `/nodia-teacher/${id}`;
const router = createMemoryRouter([{ path: "/nodia-teacher", element: <Teacher /> }, { path: "/nodia-teacher/:sessionId", element: <Teacher /> }], { initialEntries: [initialEntry] });
if (realHttp) router.subscribe(state => {
  const url = new URL(location.href);
  const sessionId = state.location.pathname.split("/")[2];
  if (sessionId) url.searchParams.set("sessionId", sessionId); else url.searchParams.delete("sessionId");
  history.replaceState(null, "", url);
});
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}><MUIProvider><PageContent><RouterProvider router={router} /></PageContent></MUIProvider></QueryClientProvider>);
