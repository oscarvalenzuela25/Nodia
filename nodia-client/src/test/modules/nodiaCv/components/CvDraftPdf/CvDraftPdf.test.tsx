import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CvDraftPdf from "../../../../../modules/nodiaCv/components/CvDraftPdf";
import { fetchCvDraftPdf, prepareCvPdf, saveCvVersion, type CvPdfArtifact } from "../../../../../modules/nodiaCv/infrastructure/pdfVersions";
import i18n from "../../../../../translate";

vi.mock("../../../../../modules/nodiaCv/infrastructure/pdfVersions", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../../../../modules/nodiaCv/infrastructure/pdfVersions")>(),
  prepareCvPdf: vi.fn(),
  fetchCvDraftPdf: vi.fn(),
  saveCvVersion: vi.fn(),
}));

const artifact: CvPdfArtifact = {
  id: "875d1570-b160-40a4-8ec0-09215cd436de",
  generation_id: "2aa8212a-741c-44bb-a737-34d4d131cb78", revision: 2, template: "classic", language: "es",
  format: "a4", renderer: "fixture/1", sha256: "f".repeat(64), page_count: 1,
  extracted_text: "Private fixture", missing_contact: false, expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
};
const t = (name: string) => i18n.t(`nodiaCv:${name}`);

function openDraft() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <CvDraftPdf active generationId={artifact.generation_id} revision={artifact.revision} language="es" disabled={false}
        onDenial={vi.fn()} onRefresh={vi.fn()} onOpenVersions={vi.fn()} />
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.resetAllMocks());

describe("prepare and save CV", () => {
  it("requires explicit save and reuses the same key and artifact after an uncertain write", async () => {
    const user = userEvent.setup();
    vi.mocked(prepareCvPdf).mockResolvedValue(artifact);
    vi.mocked(fetchCvDraftPdf).mockResolvedValue({ buffer: new ArrayBuffer(8), sha256: artifact.sha256 });
    vi.mocked(saveCvVersion).mockRejectedValueOnce(new Error("Connection lost")).mockResolvedValueOnce({
      ...artifact, version_number: 4, profile_name: "Fixture", vacancy_title: null, vacancy_company: null,
      created_at: "2026-11-24T16:00:00.000Z", analysis: null,
    });
    openDraft();
    const save = () => screen.getByRole("button", { name: t("version_save") });
    expect(save()).toBeDisabled();
    await user.click(screen.getByRole("button", { name: t("pdf_prepare") }));
    await waitFor(() => expect(save()).toBeEnabled());
    expect(saveCvVersion).not.toHaveBeenCalled();
    await user.click(save());
    expect(await screen.findByText(t("version_save_uncertain"))).toBeVisible();
    await user.click(save());
    await screen.findByRole("button", { name: t("versions_open_history") });
    const calls = vi.mocked(saveCvVersion).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toBe(artifact);
    expect(calls[0][1]).toBe(calls[1][1]);
    expect(calls[1][0]).toBe(artifact);
  });

  it("keeps save blocked when the returned bytes fail the digest check", async () => {
    const user = userEvent.setup();
    vi.mocked(prepareCvPdf).mockResolvedValue(artifact);
    vi.mocked(fetchCvDraftPdf).mockRejectedValue(new Error("Unreadable file"));
    openDraft();
    await user.click(screen.getByRole("button", { name: t("pdf_prepare") }));
    expect(await screen.findByRole("button", { name: t("pdf_retry_file") })).toBeEnabled();
    expect(screen.getByRole("button", { name: t("version_save") })).toBeDisabled();
    expect(saveCvVersion).not.toHaveBeenCalled();
  });
});
