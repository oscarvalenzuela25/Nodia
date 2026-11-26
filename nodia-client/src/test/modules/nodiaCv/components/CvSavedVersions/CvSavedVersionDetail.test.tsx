import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { AxiosHeaders, type AxiosAdapter } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mainInstance } from "../../../../../config/api";
import CvSavedVersionDetail from "../../../../../modules/nodiaCv/components/CvSavedVersions/CvSavedVersionDetail";
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

function openVersion(data: unknown) {
  const adapter = vi.fn<AxiosAdapter>(
    async (config) => ({ config, data, status: 200, statusText: "OK", headers: new AxiosHeaders() }),
  );
  mainInstance.defaults.adapter = adapter;
  render(
    <QueryClientProvider client={client}>
      <CvSavedVersionDetail target={version} onClose={vi.fn()} onMissing={vi.fn()} onDelete={vi.fn()} onDenial={vi.fn()} />
    </QueryClientProvider>,
  );
  return adapter;
}

describe("saved CV analysis and preview", () => {
  it("opens the exact saved document and renders its linked and declared evidence read-only", async () => {
    const adapter = openVersion({ ...version, analysis });
    const dialog = within(await screen.findByRole("dialog"));
    expect(await dialog.findByText(version.extracted_text)).toBeVisible();
    expect(dialog.getByText("TypeScript at time of save")).toBeVisible();
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
});
