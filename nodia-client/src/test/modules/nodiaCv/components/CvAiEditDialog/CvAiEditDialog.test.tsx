import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders, type AxiosAdapter } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mainInstance } from "../../../../../config/api";
import { CvAiEditDialog } from "../../../../../modules/nodiaCv/components/CvAiEditDialog/CvAiEditDialog";
import { cvAiEditRequestKey, rememberCvAiEditReceipt } from "../../../../../modules/nodiaCv/infrastructure/cvAiEditReceiptStorage";
import { cvGenerationSchema } from "../../../../../modules/nodiaCv/infrastructure/generationSchema";
import { emptyProfile, profileRecordSchema } from "../../../../../modules/nodiaCv/infrastructure/profileSchema";
import type { CvAiEditApplyResult } from "../../../../../modules/nodiaCv/infrastructure/useCvAiEdit";
import type { CvGenerationView } from "../../../../../modules/nodiaCv/infrastructure/useCvGenerationWorkflow";
import useAuthStore from "../../../../../store/authStore";
import i18n from "../../../../../translate";

const owner = "42";
const baseId = "875d1570-b160-40a4-8ec0-09215cd436de";
const childId = "5631301f-18da-4b68-a4ef-702a84e5ec63";
const key = "ebf95073-9ac2-42c0-8593-b248f3c3dc2a";
const revision = 2;
const target = { baseId, revision };
const selection = { connection_id: "7", mode: "agentic", model_id: "fixture-model", effort_id: "medium" } as const;
const profile = profileRecordSchema.parse({
  ...emptyProfile,
  id: "5631301f-18da-4b68-a4ef-702a84e5ec62", profile_name: "Synthetic profile",
  full_name: "Synthetic candidate", revision: 1, schema_version: 1,
  created_at: "2026-11-24T12:00:00.000Z", updated_at: "2026-11-24T12:00:00.000Z",
});
const fact = {
  id: "e1", section: "skills", groupId: "g1", field: "name", text: "Original TypeScript skill",
} as const;
const project = {
  id: "e2", section: "project", groupId: "g2", field: "name", text: "Verified TypeScript project",
} as const;
const review = { revision, included_fact_ids: ["e1"], evidence: [] };
const draft = { schemaVersion: 1, locale: "es", requirements: [], selectedFacts: [fact], remainingFacts: [project] };
const receipt = cvGenerationSchema.parse({
  id: baseId, profile_id: profile.id, profile_revision: 1, language: "es", vacancy_title: "Fixture vacancy",
  vacancy_company: null, selection, created_at: "2026-11-24T12:00:00.000Z",
  expires_at: "2099-11-24T12:00:00.000Z", state: "ready", error_code: null, draft, review,
});
const view: CvGenerationView = {
  receipt, profile, intent: {
    request_key: "c412a110-0a0d-46f0-82bf-178b2a3f3d12", profile_id: receipt.profile_id, profile_revision: 1,
    language: "es", vacancy_title: "Fixture vacancy", vacancy_company: "", offer_text: "Original offer", selection,
  },
};
const child = cvGenerationSchema.parse({
  ...receipt,
  id: childId,
  edit: { base_generation_id: baseId, base_revision: revision },
  draft: { ...draft, selectedFacts: [project], remainingFacts: [fact] },
  review: { ...review, revision: 1, included_fact_ids: ["e2"], section_order: ["project"] },
});
const t = (name: string) => i18n.t(`nodiaCv:${name}`);
const original = mainInstance.defaults.adapter;
let client: QueryClient;

beforeEach(() => {
  client = new QueryClient();
  sessionStorage.clear();
  useAuthStore.setState({
    user: { id: owner, name: "Synthetic owner" }, token: "synthetic",
    sessionVersion: 1, sessionStatus: "authenticated", isRefreshing: false, expiresAt: Date.now() + 60_000,
  });
});

afterEach(() => {
  client.clear();
  sessionStorage.clear();
  mainInstance.defaults.adapter = original;
  useAuthStore.setState({ user: null, token: null, sessionStatus: "anonymous" });
});

function open(adapter: AxiosAdapter) {
  mainInstance.defaults.adapter = adapter;
  const onApply = vi.fn<() => Promise<CvAiEditApplyResult>>().mockResolvedValue("applied");
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <CvAiEditDialog base={view} selection={selection} onApply={onApply} onClose={onClose} onDenial={vi.fn()} />
    </QueryClientProvider>,
  );
  const dialog = within(screen.getByRole("dialog", { name: t("ai_edit.open") }));
  const input = dialog.getByLabelText(t("ai_edit.instructions"), { exact: false });
  return { dialog, input, onApply, onClose, user: userEvent.setup() };
}

const headers = new AxiosHeaders();
const success = (config: Parameters<AxiosAdapter>[0], data: unknown) => ({ config, data, status: 200, statusText: "OK", headers });
const failure = (config: Parameters<AxiosAdapter>[0], status: number, message: string) =>
  new AxiosError(message, undefined, config, undefined, { status, statusText: message, data: { message }, headers, config });

describe("CV AI edit", () => {
  it("shows verified changes and closes only after a fresh explicit application succeeds", async () => {
    const adapter = vi.fn<AxiosAdapter>(async config => success(config, child));
    const { dialog, input, onApply, onClose, user } = open(adapter);
    onApply.mockResolvedValueOnce("unavailable");
    const propose = dialog.getByRole("button", { name: t("ai_edit.propose") });
    expect(propose).toBeDisabled();
    await user.type(input, "Prioriza proyectos.");
    await user.click(propose);
    expect(await dialog.findByText(project.text)).toBeVisible();
    expect(dialog.getByText(fact.text)).toBeVisible();
    expect(onApply).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    const [post] = adapter.mock.calls.find(([config]) => config.method === "post")!;
    const submitted = JSON.parse(post.data as string);
    expect(post.url).toContain(`/drafts/${baseId}/ai-edits`);
    expect(submitted).toEqual({ request_key: expect.any(String), revision, selection, instructions: "Prioriza proyectos." });
    const apply = dialog.getByRole("button", { name: t("ai_edit.apply") });
    await waitFor(() => expect(apply).toBeEnabled());
    await user.click(apply);
    expect(await dialog.findByText(t("ai_edit.apply_unavailable"))).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
    await user.click(apply);
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onApply).toHaveBeenLastCalledWith({ intent: { ...view.intent, request_key: submitted.request_key }, receipt: child });
    expect(cvAiEditRequestKey(owner, target)).toBeNull();
  });

  it("preserves the instructions on a refusal and retains an unknown remote receipt when keeping the original", async () => {
    let calls = 0;
    const terminalUnknown = { ...child, state: "unknown", draft: null, review: null };
    const adapter = vi.fn<AxiosAdapter>(async config => {
      if (config.method === "post" && ++calls === 1) throw failure(config, 409, "nodiaCv:edit_in_progress");
      return success(config, terminalUnknown);
    });
    const { dialog, input, onApply, onClose, user } = open(adapter);
    await user.type(input, "Prioriza el proyecto.");
    await user.click(dialog.getByRole("button", { name: t("ai_edit.propose") }));
    expect(await dialog.findByText(t("edit_in_progress"))).toBeVisible();
    expect(input).toHaveValue("Prioriza el proyecto.");
    expect(onClose).not.toHaveBeenCalled();
    expect(cvAiEditRequestKey(owner, target)).toBeNull();

    await user.type(input, " También competencias.");
    await user.click(dialog.getByRole("button", { name: t("ai_edit.propose") }));
    expect(await dialog.findByText(t("ai_edit.unknown"))).toBeVisible();
    expect(dialog.queryByRole("button", { name: t("ai_edit.apply") })).not.toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: t("ai_edit.keep") }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onApply).not.toHaveBeenCalled();
    expect(cvAiEditRequestKey(owner, target)).not.toBeNull();
    expect(sessionStorage.getItem("nodia-cv-ai-edit-recovery")).not.toContain("Prioriza");
    expect(calls).toBe(2);
  });

  it("continues an ambiguous POST only after an explicit request lookup and reuses the same key and instructions", async () => {
    let sent = 0;
    const adapter = vi.fn<AxiosAdapter>(async config => {
      if (config.method === "post" && ++sent === 1) throw new AxiosError("Lost reply", "ECONNABORTED", config);
      if (config.url?.includes("/generations/requests/")) throw failure(config, 404, "nodiaCv:generation_not_found");
      return success(config, child);
    });
    const { dialog, input, onApply, user } = open(adapter);
    await user.type(input, "Mueve los proyectos al principio.");
    await user.click(dialog.getByRole("button", { name: t("ai_edit.propose") }));
    const check = await dialog.findByRole("button", { name: t("ai_edit.check") });
    await waitFor(() => expect(check).toBeEnabled());
    expect(sent).toBe(1);
    await user.click(check);
    expect(await dialog.findByText(t("ai_edit.missing"))).toBeVisible();
    expect(sent).toBe(1);
    await user.click(dialog.getByRole("button", { name: t("ai_edit.resume") }));
    await dialog.findByText(project.text);
    const posts = adapter.mock.calls.filter(([config]) => config.method === "post");
    expect(posts).toHaveLength(2);
    expect(posts[0][0].data).toBe(posts[1][0].data);
    expect(onApply).not.toHaveBeenCalled();
  });

  it("rejects a recovered proposal for a different original offer", async () => {
    rememberCvAiEditReceipt(owner, target, key);
    const adapter = vi.fn<AxiosAdapter>(async config => success(config, {
      ...child, recovery: { offer_text: "Another offer", profile },
    }));
    const { dialog, onApply, onClose, user } = open(adapter);
    await user.click(dialog.getByRole("button", { name: t("ai_edit.check") }));
    expect(await dialog.findByRole("alert")).toBeVisible();
    expect(dialog.queryByRole("button", { name: t("ai_edit.apply") })).not.toBeInTheDocument();
    expect(cvAiEditRequestKey(owner, target)).toBe(key);
    expect(onApply).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(adapter).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      url: expect.stringContaining(`/generations/requests/${key}`), method: "get",
    }));
  });

  it("reports an unchanged proposal without requiring a confirmation to keep editing", async () => {
    const adapter = vi.fn<AxiosAdapter>(async config => success(config, {
      ...child, draft, review: { ...review, revision: 1, section_order: ["skills"] },
    }));
    const { dialog, input, onApply, onClose, user } = open(adapter);
    await user.type(input, "Conserva estas competencias.");
    await user.click(dialog.getByRole("button", { name: t("ai_edit.propose") }));
    expect(await dialog.findByText(t("ai_edit.no_changes"))).toBeVisible();
    expect(input).toBeEnabled();
    expect(dialog.queryByRole("button", { name: t("ai_edit.apply") })).not.toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
