import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders, type AxiosAdapter } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mainInstance } from "../../../../../config/api";
import CvSavedVersionDetail from "../../../../../modules/nodiaCv/components/CvSavedVersions/CvSavedVersionDetail";
import { emptyProfile } from "../../../../../modules/nodiaCv/infrastructure/profileSchema";
import useAuthStore from "../../../../../store/authStore";
import i18n from "../../../../../translate";

const version = {
  id: "875d1570-b160-40a4-8ec0-09215cd436de",
  version_number: 4,
  profile_name: "Synthetic original profile",
  vacancy_title: "Synthetic original vacancy",
  vacancy_company: null,
  language: "en",
  template: "classic",
  created_at: "2026-11-24T16:00:00.000Z",
  format: "a4",
  renderer: "fixture/1",
  sha256: "f".repeat(64),
  page_count: 1,
  extracted_text: "Exact saved synthetic CV text",
  missing_contact: false,
} as const;
const analysis = {
  requirements: [{ id: "r1", quote: "TypeScript at time of save", kind: "required", coverage: "supported", evidenceIds: ["e1"] }],
  facts: [{ id: "e1", groupId: "g1", section: "project", field: "technologies", text: "Saved project fact" }],
  evidence: [{ requirement_id: "r1", source: "Saved evidence source", detail: "Saved evidence detail" }],
};
const t = (name: string) => i18n.t(`nodiaCv:${name}`);
const original = mainInstance.defaults.adapter;
let client: QueryClient;

beforeEach(() => {
  client = new QueryClient();
  useAuthStore.setState({
    user: { id: "42", name: "Synthetic owner" }, token: "synthetic",
    sessionVersion: 1, sessionStatus: "authenticated", isRefreshing: false, expiresAt: Date.now() + 60_000,
  });
});

afterEach(() => {
  client.clear();
  mainInstance.defaults.adapter = original;
  useAuthStore.setState({ user: null, token: null, sessionStatus: "anonymous" });
});

function openVersion(data: unknown, onEditCopy = vi.fn(), post?: AxiosAdapter) {
  const adapter = vi.fn<AxiosAdapter>(
    async (config) => config.method === "post" && post
      ? post(config) : { config, data, status: 200, statusText: "OK", headers: new AxiosHeaders() },
  );
  mainInstance.defaults.adapter = adapter;
  render(
    <QueryClientProvider client={client}>
      <CvSavedVersionDetail target={version} onClose={vi.fn()} onMissing={vi.fn()} onDelete={vi.fn()} onDenial={vi.fn()}
        onEditCopy={onEditCopy} />
    </QueryClientProvider>,
  );
  return adapter;
}

describe("saved CV analysis and preview", () => {
  it("opens the exact saved document and renders its linked and declared evidence read-only", async () => {
    const adapter = openVersion({ ...version, analysis });
    const dialog = within(await screen.findByRole("dialog"));
    const pdfText = await dialog.findByText(version.extracted_text);
    const requirement = dialog.getByText("TypeScript at time of save");
    expect(pdfText).toBeVisible();
    expect(requirement).toBeVisible();
    expect(pdfText.compareDocumentPosition(requirement) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(dialog.getByText(/Saved project fact/)).toBeVisible();
    expect(dialog.getByText(/Saved evidence source · Saved evidence detail/)).toBeVisible();
    expect(dialog.queryByRole("button", { name: /Revisar evidencia/ })).not.toBeInTheDocument();
    expect(adapter).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      url: expect.stringMatching(new RegExp(`/versions/${version.id}$`)), method: "get",
    }));
  });

  it("opens legacy saved CVs with their PDF text when the server has no stored analysis", async () => {
    openVersion(version);
    const dialog = within(await screen.findByRole("dialog"));
    expect(await dialog.findByText(t("version_requirements_unavailable"))).toBeVisible();
    expect(dialog.getByText(version.extracted_text)).toBeVisible();
  });

  it("keeps the original open on a copy error and retries the same copy before transferring it", async () => {
    const profile = {
      ...emptyProfile,
      id: "f75d80ab-1a1f-4f97-a3c2-2af81e8979c3",
      profile_name: version.profile_name,
      full_name: "Synthetic candidate",
      revision: 3,
      schema_version: 1,
      created_at: version.created_at,
      updated_at: version.created_at,
    };
    const receipt = {
      id: "d2582d92-fe71-4449-bb5a-2a70966adbe7", state: "ready",
      profile_id: profile.id, profile_revision: profile.revision,
      selection: null, source_version: { id: version.id, template: version.template },
      language: version.language, vacancy_title: version.vacancy_title, vacancy_company: null,
      created_at: version.created_at, expires_at: new Date(Date.now() + 60_000).toISOString(), error_code: null,
      draft: { schemaVersion: 1, locale: version.language, requirements: [], selectedFacts: [], remainingFacts: [] },
      review: { revision: 1, included_fact_ids: [], evidence: analysis.evidence },
      recovery: { offer_text: "", profile },
    };
    const onEditCopy = vi.fn();
    const post = vi.fn<AxiosAdapter>()
      .mockImplementationOnce(async (config) => {
        throw new AxiosError("Temporary server error", undefined, config, undefined, {
          config, data: { message: "nodiaCv:request_failed" }, status: 503, statusText: "Unavailable", headers: {},
        });
      })
      .mockImplementationOnce(async (config) => ({
        config, data: receipt, status: 200, statusText: "OK", headers: {},
      }));
    const adapter = openVersion(version, onEditCopy, post);
    const user = userEvent.setup();
    const dialog = within(await screen.findByRole("dialog"));
    expect(await dialog.findByText(version.extracted_text)).toBeVisible();
    const editCopy = dialog.getByRole("button", { name: t("version_edit_copy") });
    await user.click(editCopy);
    expect(await dialog.findByText(t("request_failed"))).toBeVisible();
    expect(dialog.getByText(version.extracted_text)).toBeVisible();
    expect(onEditCopy).not.toHaveBeenCalled();

    await user.click(editCopy);
    await waitFor(() => expect(onEditCopy).toHaveBeenCalledExactlyOnceWith({
      intent: expect.objectContaining({ offer_text: "", selection: null, source_version: receipt.source_version }),
      profile: expect.objectContaining({ id: profile.id, revision: profile.revision }),
      receipt: expect.objectContaining({ id: receipt.id, selection: null, review: receipt.review }),
    }));
    const [first, retry] = post.mock.calls.map(([config]) => config);
    expect(first.url).toMatch(new RegExp(`/versions/${version.id}/draft-copy$`));
    expect(JSON.parse(first.data)).toEqual({ request_key: expect.any(String) });
    expect(retry.data).toBe(first.data);
    expect(adapter.mock.calls.map(([config]) => config.method)).toEqual(["get", "post", "post"]);
  });
});
