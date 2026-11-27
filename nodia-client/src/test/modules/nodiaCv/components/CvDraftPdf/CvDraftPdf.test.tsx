import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CvDraftPdf from "../../../../../modules/nodiaCv/components/CvDraftPdf";
import type { CvDraftPdfHandle } from "../../../../../modules/nodiaCv/components/CvDraftPdf/CvDraftPdf";
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

function openDraft({ disabled = false } = {}) {
  const ref = createRef<CvDraftPdfHandle>();
  const onSaved = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CvDraftPdf ref={ref} active generationId={artifact.generation_id} revision={artifact.revision} language="es"
        disabled={disabled} onDenial={vi.fn()} onRefresh={vi.fn()} onOpenVersions={vi.fn()} onSaved={onSaved} />
    </QueryClientProvider>,
  );
  const saveForExit = async () => {
    let saved = false;
    await act(async () => { saved = await ref.current!.saveForExit(); });
    return saved;
  };
  return { saveForExit, onSaved };
}

const verifiedBytes = { buffer: new ArrayBuffer(8), sha256: artifact.sha256 };
const savedVersion = {
  ...artifact, version_number: 4, profile_name: "Fixture", vacancy_title: null, vacancy_company: null,
  created_at: "2026-11-24T16:00:00.000Z", analysis: null,
};

beforeEach(() => vi.resetAllMocks());

describe("prepare and save CV", () => {
  it("requires explicit save and reuses the same key and artifact after an uncertain write", async () => {
    const user = userEvent.setup();
    vi.mocked(prepareCvPdf).mockResolvedValue(artifact);
    vi.mocked(fetchCvDraftPdf).mockResolvedValue(verifiedBytes);
    vi.mocked(saveCvVersion).mockRejectedValueOnce(new Error("Connection lost")).mockResolvedValueOnce(savedVersion);
    const { onSaved } = openDraft();
    const save = () => screen.getByRole("button", { name: t("version_save") });
    expect(save()).toBeDisabled();
    await user.click(screen.getByRole("button", { name: t("pdf_prepare") }));
    await waitFor(() => expect(save()).toBeEnabled());
    expect(saveCvVersion).not.toHaveBeenCalled();
    await user.click(save());
    expect(await screen.findByText(t("version_save_uncertain"))).toBeVisible();
    expect(onSaved).not.toHaveBeenCalled();
    await user.click(save());
    await screen.findByRole("button", { name: t("versions_open_history") });
    const calls = vi.mocked(saveCvVersion).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toBe(artifact);
    expect(calls[0][1]).toBe(calls[1][1]);
    expect(calls[1][0]).toBe(artifact);
    expect(onSaved).toHaveBeenCalledOnce();
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

  it.each(["compact", "editorial", "contemporary"] as const)("prepares, verifies and saves %s on explicit exit", async (template) => {
    const user = userEvent.setup();
    const selected: CvPdfArtifact = { ...artifact, template };
    vi.mocked(prepareCvPdf).mockResolvedValue(selected);
    vi.mocked(fetchCvDraftPdf).mockResolvedValue(verifiedBytes);
    vi.mocked(saveCvVersion).mockResolvedValue({ ...savedVersion, template });
    const { saveForExit, onSaved } = openDraft();
    const choice = screen.getByRole("button", { name: t(`pdf_templates.${template}`) });
    await user.click(choice);
    expect(choice).toHaveAttribute("aria-pressed", "true");
    expect(saveCvVersion).not.toHaveBeenCalled();

    expect(await saveForExit()).toBe(true);
    expect(prepareCvPdf).toHaveBeenCalledExactlyOnceWith(artifact.generation_id, {
      revision: artifact.revision, template, language: "es",
    }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(fetchCvDraftPdf).toHaveBeenCalledExactlyOnceWith(selected, expect.anything());
    expect(saveCvVersion).toHaveBeenCalledExactlyOnceWith(selected, expect.any(String), expect.anything());
    expect(onSaved).toHaveBeenCalledOnce();

    expect(await saveForExit()).toBe(true);
    expect(saveCvVersion).toHaveBeenCalledOnce();
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("stays on the draft when exit verification or save fails, and recovers the same save key", async () => {
    vi.mocked(prepareCvPdf).mockResolvedValue(artifact);
    vi.mocked(fetchCvDraftPdf).mockRejectedValueOnce(new Error("Unreadable file")).mockResolvedValueOnce(verifiedBytes);
    vi.mocked(saveCvVersion).mockRejectedValueOnce(new Error("Connection lost")).mockResolvedValueOnce(savedVersion);
    const { saveForExit, onSaved } = openDraft();

    expect(await saveForExit()).toBe(false);
    expect(saveCvVersion).not.toHaveBeenCalled();
    expect(await saveForExit()).toBe(false);
    expect(screen.getByText(t("version_save_uncertain"))).toBeVisible();
    expect(onSaved).not.toHaveBeenCalled();
    expect(await saveForExit()).toBe(true);
    expect(onSaved).toHaveBeenCalledOnce();
    const calls = vi.mocked(saveCvVersion).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][1]).toBe(calls[1][1]);
    expect(prepareCvPdf).toHaveBeenCalledOnce();
  });

  it("does not start exit saving while the review is unavailable", async () => {
    const { saveForExit, onSaved } = openDraft({ disabled: true });
    expect(await saveForExit()).toBe(false);
    expect(prepareCvPdf).not.toHaveBeenCalled();
    expect(saveCvVersion).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
