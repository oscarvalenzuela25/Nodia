import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { expect, it, vi } from "vitest";
import Teacher from "../../../../../modules/teacher/pages/Teacher";
import { forgetRequest, pendingRequest, rememberRequest } from "../../../../../modules/teacher/infrastructure/recovery";
import { readTeacher, readTeacherData, readTeacherReceipt, sendTeacher } from "../../../../../modules/teacher/infrastructure/services";
import type { Job, Session } from "../../../../../modules/teacher/infrastructure/schemas";
import useAuthStore from "../../../../../store/authStore";
import { planFixture } from "../../fixtures";

vi.mock("../../../../../modules/teacher/infrastructure/services", () => ({
  readTeacherData: vi.fn(), readTeacher: vi.fn(), readTeacherReceipt: vi.fn(), sendTeacher: vi.fn(),
}));

it("opens an existing plan while a missing receipt still protects the previous write", async () => {
  const auth = useAuthStore.getState();
  auth.login({ token: "synthetic-never-sent", expiresAt: Date.now() + 900_000, user: { id: "1", name: "Synthetic QA" } });
  const scope = `1:${useAuthStore.getState().sessionVersion}`;
  const key = "11111111-1111-4111-8111-111111111111";
  rememberRequest(scope, { requestKey: key, path: "sessions", method: "POST", body: {} });
  vi.mocked(readTeacherData).mockResolvedValue({
    data: [{ id: "fixture-plan", title: "Redes", topic: "DNS", objective: "Comprender DNS", state: "draft", revision: 1, updated_at: "2026-11-18T00:00:00.000Z" }],
    meta: { page: 1, limit: 10, total_items: 1, total_pages: 1 },
  });
  vi.mocked(readTeacherReceipt).mockRejectedValue({ isAxiosError: true, response: { status: 404, data: { code: "not_found" } } });
  const client = new QueryClient();
  const router = createMemoryRouter([
    { path: "/nodia-teacher", element: <Teacher /> },
    { path: "/nodia-teacher/:sessionId", element: <h1>Plan abierto</h1> },
  ], { initialEntries: ["/nodia-teacher"] });
  const view = render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>);
  try {
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Consultar guardado" }));
    expect(await screen.findByRole("button", { name: "Cerrar solicitud pendiente" })).toBeEnabled();
    await user.click(screen.getByRole("link", { name: "Abrir plan" }));
    expect(await screen.findByRole("heading", { name: "Plan abierto" })).toBeInTheDocument();
    expect(pendingRequest(scope)?.requestKey).toBe(key);
    expect(sendTeacher).not.toHaveBeenCalled();
  } finally {
    view.unmount();
    router.dispose();
    client.clear();
    forgetRequest();
  }
});

it("keeps an assessment notice above the lesson actions and advances only the saved cursor", async () => {
  const auth = useAuthStore.getState();
  auth.login({ token: "synthetic-never-sent", expiresAt: Date.now() + 900_000, user: { id: "1", name: "Synthetic QA" } });
  const client = new QueryClient();
  const sessionId = "fixture-session";
  const sessionPath = `sessions/${sessionId}`;
  const version = useAuthStore.getState().sessionVersion;
  const [section] = planFixture.outline.sections;
  const enabled = { enabled: true, reason_code: null };
  const jobId = "fixture-assessment";
  let job: Job = {
    job_id: jobId, fence: "1", purpose: "assessment_only", state: "running",
    retry_after_ms: 30_000, result_ref: null, local_closed: null, remote_outcome: null, error_code: null, allowed_actions: {},
  };
  const session: Session = {
    id: sessionId, title: "Curso de redes", topic: "Redes", objective: "Comprender redes", state: "active", revision: 1,
    updated_at: "2026-11-18T00:00:00.000Z", declared_base: null, context: null, explanation_language: "es",
    requested_organization: "topics", requested_day_count: null, setup_draft_text: "", setup_draft_revision: 0,
    dispatch_limit: 200, dispatches_used: 1, selection: null, latest_job_id: jobId,
    active_jobs: [job], active_attempts: [],
    allowed_actions: { pause: enabled, start_section_final: enabled },
    section_states: [{ section_id: "s1", verification_state: "not_verified", allowed_actions: { start_final: enabled } }],
    cursor: { revision: 3, phase: "theory", plan_revision_id: planFixture.id, section_id: "s1", unit_id: "u1",
      content_version_id: "content-u1", attempt_id: null, item_id: null, block_id: null },
    current_plan: { ...planFixture, state: "active", outline: { ...planFixture.outline, sections: [
      { ...section, units: [...section.units, { ...section.units[0], id: "same-section", title: "Otra unidad de DNS" }] },
      { ...section, id: "s2", title: "Transporte", prerequisite_section_ids: ["s1"], units: [
        { ...section.units[0], id: "u2", title: "Primera lección de transporte" },
      ] },
    ] } },
  };
  vi.mocked(readTeacher).mockImplementation(async (path, schema) => {
    if (path === `jobs/${jobId}`) return schema.parse(job);
    throw new Error(`Unexpected job read ${path}`);
  });
  vi.mocked(readTeacherData).mockImplementation(async path => {
    if (path === sessionPath) return structuredClone(session);
    if (path === `${sessionPath}/messages`) return { data: [], meta: { page: 1, limit: 50, total_items: 0, total_pages: 0 } };
    if (path === `${sessionPath}/units/u1` || path === `${sessionPath}/units/u2`) {
      const unitId = path.split("/").at(-1);
      return { kind: "material", resource_id: `material-${unitId}`, content_version_id: `content-${unitId}`, unit_id: unitId, plan_revision_id: planFixture.id,
        blocks: [{ id: `block-${unitId}`, title: "Explicación", body_markdown: "Contenido de ejemplo" }], allowed_actions: { start_practice: enabled } };
    }
    throw new Error(`Unexpected Teacher read ${path}`);
  });
  const destination = {
    phase: "setup", plan_revision_id: planFixture.id, section_id: "s2", unit_id: "u2", content_version_id: null,
    attempt_id: null, item_id: null, block_id: null,
  } as const;
  let finishCursor: () => void = () => { throw new Error("The cursor write did not start"); };
  vi.mocked(sendTeacher).mockImplementation(async () => {
    await new Promise<void>(resolve => { finishCursor = resolve; });
    session.cursor = { ...destination, revision: 4 };
    return { session_id: sessionId, revision: 4 };
  });
  const router = createMemoryRouter([{ path: "/nodia-teacher/:sessionId", element: <Teacher /> }], { initialEntries: [`/nodia-teacher/${sessionId}`] });
  const view = render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>);
  try {
    const notice = await screen.findByText(/Teacher está preparando la evaluación solicitada/);
    const final = screen.getByRole("button", { name: "Generar evaluación final de la sección" });
    const next = screen.getByRole("button", { name: "Ir a la siguiente sección" });
    expect(notice.closest('[role="status"]')).toBeVisible();
    expect(notice.compareDocumentPosition(final) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(final.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Actualizar estado" })).not.toBeInTheDocument();

    await userEvent.click(next);
    await waitFor(() => expect(sendTeacher).toHaveBeenCalledOnce());
    expect(vi.mocked(sendTeacher).mock.calls[0][0]).toMatchObject({
      method: "PATCH", path: `${sessionPath}/cursor`, body: { expected_cursor_revision: 3, ...destination },
    });
    job = { ...job, state: "ready", result_ref: { attempt_id: "fixture-attempt" }, retry_after_ms: null, local_closed: true, remote_outcome: "completed" };
    session.active_jobs = [];
    act(() => client.setQueryData(["teacher", "1", version, "jobs", jobId], job));
    expect(await screen.findByText("Resultado guardado")).toBeVisible();
    await act(async () => { finishCursor(); });
    expect(await screen.findByRole("heading", { name: "Primera lección de transporte" })).toHaveFocus();
    expect(screen.getByText("Resultado guardado")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Ir a la siguiente sección" })).not.toBeInTheDocument();
    expect(vi.mocked(readTeacherData).mock.calls.map(([path]) => path)).not.toContain(`${sessionPath}/attempts/fixture-attempt`);
    expect(sendTeacher).toHaveBeenCalledOnce();
  } finally {
    view.unmount();
    router.dispose();
    client.clear();
    forgetRequest();
  }
});
