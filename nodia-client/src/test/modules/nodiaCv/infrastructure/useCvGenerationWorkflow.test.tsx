import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useAuthStore from "../../../../store/authStore";
import { readCvGeneration, restoreCvGeneration, startCvGeneration } from "../../../../modules/nodiaCv/infrastructure/generations";
import type { CvGeneration, CvGenerationInput } from "../../../../modules/nodiaCv/infrastructure/generationSchema";
import { emptyProfile, profileRecordSchema } from "../../../../modules/nodiaCv/infrastructure/profileSchema";
import { cvRecoveryKeys, rememberCvReceipt } from "../../../../modules/nodiaCv/infrastructure/receiptStorage";
import { useCvGenerationWorkflow, type CvGenerationView } from "../../../../modules/nodiaCv/infrastructure/useCvGenerationWorkflow";

vi.mock("../../../../modules/nodiaCv/infrastructure/generations", async (original) => ({
  ...await original<object>(),
  startCvGeneration: vi.fn(),
  restoreCvGeneration: vi.fn(),
  readCvGeneration: vi.fn(),
  useCvGenerationStatus: () => ({ data: undefined, error: null }),
}));

const owner = "42";
const oldKey = "ebf95073-9ac2-42c0-8593-b248f3c3dc2a";
const noDenial = vi.fn();
const profile = profileRecordSchema.parse({
  ...emptyProfile,
  id: "5631301f-18da-4b68-a4ef-702a84e5ec62",
  full_name: "Synthetic candidate",
  profile_name: "Synthetic profile",
  revision: 1,
  schema_version: 1,
  created_at: "2026-11-24T12:00:00.000Z",
  updated_at: "2026-11-24T12:00:00.000Z",
});
const input: Omit<CvGenerationInput, "request_key"> = {
  profile_id: profile.id,
  profile_revision: profile.revision,
  language: "es",
  vacancy_title: "Fixture role",
  vacancy_company: "",
  offer_text: "Synthetic offer",
  selection: { connection_id: "13", mode: "agentic", model_id: "synthetic-runner", effort_id: "high" },
};
const queued: CvGeneration = {
  id: "65f80709-2f27-4ee7-af45-a79843d92d3e",
  profile_id: input.profile_id,
  profile_revision: input.profile_revision,
  language: input.language,
  vacancy_title: input.vacancy_title,
  vacancy_company: null,
  selection: input.selection,
  expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  created_at: new Date().toISOString(),
  state: "queued",
  error_code: null,
  draft: null,
};
const ready: CvGeneration = {
  ...queued,
  state: "ready",
  draft: { schemaVersion: 1, locale: "es", requirements: [], selectedFacts: [], remainingFacts: [] },
};
const newInput = {
  ...input,
  offer_text: "Different synthetic offer",
  selection: { ...input.selection, model_id: "different-synthetic-runner" },
};
const newReady: CvGeneration = {
  ...ready, id: "5631301f-18da-4b68-a4ef-702a84e5ec63", selection: newInput.selection,
};

function httpError(status: number, message = "fixture") {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError(message, undefined, config, undefined, {
    status, statusText: message, data: { message }, headers: {}, config,
  });
}

let client: QueryClient;
function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.resetAllMocks();
  client = new QueryClient();
  window.sessionStorage.clear();
  useAuthStore.setState({
    user: { id: owner, name: "Synthetic owner" }, token: "synthetic",
    sessionVersion: 1, sessionStatus: "authenticated", isRefreshing: false, expiresAt: Date.now() + 60_000,
  });
});

afterEach(() => {
  client.clear();
  useAuthStore.setState({ user: null, token: null, sessionStatus: "anonymous" });
});

function open() {
  return renderHook(({ active }) => useCvGenerationWorkflow(active, noDenial), {
    initialProps: { active: true }, wrapper: Wrapper,
  });
}

describe("CV tab navigation and recovery", () => {
  it("applies a separately selected model to a copied version while verifying its archived source", async () => {
    const source_version = { id: "67b4026d-9179-4a78-96e5-a09ffeaea318", template: "compact" } as const;
    const intent = { ...input, request_key: oldKey, offer_text: "", selection: null, source_version };
    const review = { revision: 1, included_fact_ids: [], evidence: [] };
    const receipt = { ...ready, selection: null, source_version, review };
    const base: CvGenerationView = { intent, receipt, profile };
    const view = renderHook(() => useCvGenerationWorkflow(true, noDenial, base), { wrapper: Wrapper });
    const next = {
      intent: { ...intent, request_key: crypto.randomUUID(), selection: newInput.selection },
      receipt: { ...newReady, source_version, edit: { base_generation_id: receipt.id, base_revision: 1 }, review },
    };
    expect(view.result.current.visible?.receipt).toEqual(receipt);
    await act(async () => {
      const differentSource = { ...source_version, id: crypto.randomUUID() };
      expect(await view.result.current.applyEdit(base, {
        intent: { ...next.intent, source_version: differentSource },
        receipt: { ...next.receipt, source_version: differentSource },
      })).toBe("stale");
    });
    vi.mocked(readCvGeneration).mockResolvedValue(receipt);
    await act(async () => {
      expect(await view.result.current.applyEdit(base, next)).toBe("applied");
    });
    expect(view.result.current.visible?.receipt).toEqual(next.receipt);
    expect(view.result.current.visible?.profile).toEqual(profile);
    expect(startCvGeneration).not.toHaveBeenCalled();
  });

  it("clears an already presented terminal draft on returning to Generate CV", async () => {
    vi.mocked(startCvGeneration).mockResolvedValue(ready);
    const view = open();
    await act(() => view.result.current.generate(input, profile));
    expect(view.result.current.visible?.receipt.id).toBe(ready.id);
    expect(cvRecoveryKeys(owner)).toHaveLength(1);

    view.rerender({ active: false });
    view.rerender({ active: true });
    expect(view.result.current.visible).toBeNull();
    expect(view.result.current.priorRequest).toBeNull();
    expect(cvRecoveryKeys(owner)).toEqual([]);
    expect(startCvGeneration).toHaveBeenCalledOnce();
  });

  it("does not open the delayed draft of a request after leaving and returning", async () => {
    let finish: (receipt: CvGeneration) => void = () => undefined;
    vi.mocked(startCvGeneration).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const view = open();
    let generation: Promise<void> | undefined;
    act(() => { generation = view.result.current.generate(input, profile); });
    await waitFor(() => expect(startCvGeneration).toHaveBeenCalledOnce());

    view.rerender({ active: false });
    view.rerender({ active: true });
    await act(async () => {
      finish(ready);
      await generation;
    });

    expect(view.result.current.visible).toBeNull();
    expect(view.result.current.priorRequest).toBeNull();
    expect(cvRecoveryKeys(owner)).toEqual([]);
  });

  it.each(["ready", "failed"] as const)("lets a legacy %s receipt retire when the user generates the new input", async (state) => {
    window.sessionStorage.setItem("nodia-cv-recovery", JSON.stringify({ owner, requestKey: oldKey }));
    vi.mocked(restoreCvGeneration).mockResolvedValue({
      profile, input: { ...input, request_key: oldKey }, receipt: { ...ready, state },
    });
    vi.mocked(startCvGeneration).mockResolvedValue(newReady);
    const view = open();
    expect(view.result.current.busy).toBe(false);
    expect(view.result.current.priorRequest).toBeNull();
    expect(restoreCvGeneration).not.toHaveBeenCalled();

    await act(() => view.result.current.generate(newInput, profile));

    expect(restoreCvGeneration).toHaveBeenCalledExactlyOnceWith(oldKey, 1, expect.any(AbortSignal));
    expect(startCvGeneration).toHaveBeenCalledExactlyOnceWith({ ...newInput, request_key: expect.any(String) }, 1);
    const [submitted] = vi.mocked(startCvGeneration).mock.calls[0];
    expect(submitted.request_key).not.toBe(oldKey);
    expect(view.result.current.visible?.intent.offer_text).toBe(newInput.offer_text);
    expect(view.result.current.visible?.receipt.id).toBe(newReady.id);
    expect(cvRecoveryKeys(owner)).toEqual([submitted.request_key]);
  });

  it("checks previously queued work without restoring an editor or posting the exact request again", async () => {
    vi.mocked(startCvGeneration).mockResolvedValue(queued);
    const view = open();
    await act(() => view.result.current.generate(input, profile));
    expect(view.result.current.working).toBe(true);
    const [submitted] = vi.mocked(startCvGeneration).mock.calls[0];
    vi.mocked(restoreCvGeneration).mockResolvedValue({ profile, input: submitted, receipt: queued });

    view.rerender({ active: false });
    view.rerender({ active: true });
    expect(view.result.current.visible).toBeNull();
    expect(view.result.current.priorRequest).toBeNull();
    await act(() => view.result.current.generate(input, profile));
    expect(restoreCvGeneration).toHaveBeenCalledExactlyOnceWith(submitted.request_key, 1, expect.any(AbortSignal));
    expect(view.result.current.priorRequest).toBe("working");
    expect(view.result.current.visible).toBeNull();
    expect(startCvGeneration).toHaveBeenCalledOnce();
  });

  it("protects the exact remote unknown request and keeps it when the same offer is sent to another model", async () => {
    vi.mocked(startCvGeneration).mockResolvedValue({ ...queued, state: "unknown" });
    const view = open();
    await act(() => view.result.current.generate(input, profile));
    const [submitted] = vi.mocked(startCvGeneration).mock.calls[0];
    vi.mocked(restoreCvGeneration).mockResolvedValue({
      profile, input: submitted, receipt: { ...queued, state: "unknown" },
    });
    act(view.result.current.clearPresentation);
    expect(view.result.current.receipt).toBeNull();
    expect(cvRecoveryKeys(owner)).toEqual([submitted.request_key]);

    await act(() => view.result.current.generate(input, profile));
    expect(view.result.current.receipt?.state).toBe("unknown");
    expect(view.result.current.priorRequest).toBeNull();
    expect(view.result.current.visible).toBeNull();
    expect(startCvGeneration).toHaveBeenCalledOnce();

    vi.mocked(startCvGeneration).mockResolvedValue(newReady);
    const otherModel = { ...input, selection: newInput.selection };
    await act(() => view.result.current.generate(otherModel, profile));
    const [current] = vi.mocked(startCvGeneration).mock.calls[1];
    expect(current).toEqual({ ...otherModel, request_key: expect.any(String) });
    expect(view.result.current.visible?.receipt.id).toBe(newReady.id);
    expect(cvRecoveryKeys(owner)).toEqual([current.request_key, submitted.request_key]);
  });

  it("continues a missing legacy request only on an explicit action using the same key", async () => {
    rememberCvReceipt(owner, oldKey);
    vi.mocked(restoreCvGeneration).mockRejectedValue(httpError(404));
    vi.mocked(startCvGeneration).mockResolvedValue(newReady);
    const view = open();

    await act(() => view.result.current.generate(newInput, profile));
    expect(view.result.current.priorRequest).toBe("missing");
    expect(cvRecoveryKeys(owner)).toEqual([oldKey]);
    expect(startCvGeneration).not.toHaveBeenCalled();
    expect(view.result.current.visible).toBeNull();

    await act(async () => { await view.result.current.resumeMissing(newInput, profile); });
    expect(restoreCvGeneration).toHaveBeenCalledTimes(2);
    expect(startCvGeneration).toHaveBeenCalledExactlyOnceWith({ ...newInput, request_key: oldKey }, 1);
    expect(view.result.current.visible?.receipt.id).toBe(newReady.id);
  });

  it("preserves the original request when it wins the reused key race", async () => {
    rememberCvReceipt(owner, oldKey);
    vi.mocked(restoreCvGeneration).mockRejectedValue(httpError(404));
    vi.mocked(startCvGeneration).mockRejectedValueOnce(httpError(409, "nodiaCv:request_key_conflict"));
    const view = open();
    await act(() => view.result.current.generate(newInput, profile));
    await act(async () => { await view.result.current.resumeMissing(newInput, profile); });

    expect(cvRecoveryKeys(owner)).toEqual([oldKey]);
    expect(view.result.current.uncertain).toBeNull();
    expect(view.result.current.visible).toBeNull();

    vi.mocked(restoreCvGeneration).mockResolvedValue({
      profile, input: { ...input, request_key: oldKey }, receipt: queued,
    });
    vi.mocked(startCvGeneration).mockResolvedValue(newReady);
    await act(() => view.result.current.generate(newInput, profile));
    expect(startCvGeneration).toHaveBeenCalledTimes(2);
    const [current] = vi.mocked(startCvGeneration).mock.calls[1];
    expect(current.request_key).not.toBe(oldKey);
    expect(cvRecoveryKeys(owner)).toEqual([current.request_key, oldKey]);
  });

  it("keeps the key when lookup fails and starts fresh after the server confirms it expired", async () => {
    rememberCvReceipt(owner, oldKey);
    vi.mocked(restoreCvGeneration)
      .mockRejectedValueOnce(httpError(503))
      .mockRejectedValueOnce(httpError(410));
    vi.mocked(startCvGeneration).mockResolvedValue(newReady);
    const view = open();

    await act(() => view.result.current.generate(newInput, profile));
    expect(view.result.current.admissionError).toMatchObject({ response: { status: 503 } });
    expect(cvRecoveryKeys(owner)).toEqual([oldKey]);
    expect(startCvGeneration).not.toHaveBeenCalled();

    await act(() => view.result.current.generate(newInput, profile));
    expect(view.result.current.admissionError).toBeNull();
    expect(startCvGeneration).toHaveBeenCalledOnce();
    expect(cvRecoveryKeys(owner)).not.toContain(oldKey);
  });

  it("accepts an ambiguous POST recovery only when the full offer matches the request", async () => {
    vi.mocked(startCvGeneration).mockRejectedValue(new AxiosError("lost response", "ECONNABORTED"));
    const view = open();
    await act(() => view.result.current.generate(input, profile));
    const [submitted] = vi.mocked(startCvGeneration).mock.calls[0];
    expect(view.result.current.uncertain?.intent.input).toEqual(submitted);
    vi.mocked(restoreCvGeneration).mockResolvedValue({
      profile, input: { ...submitted, offer_text: "The older original input" }, receipt: ready,
    });

    await act(() => view.result.current.recover());
    expect(view.result.current.visible).toBeNull();
    expect(view.result.current.uncertain).toBeNull();
    expect(cvRecoveryKeys(owner)).toEqual([submitted.request_key]);
    expect(startCvGeneration).toHaveBeenCalledOnce();
  });

  it("dismisses the exact saved draft without starting a new generation", async () => {
    vi.mocked(startCvGeneration).mockResolvedValueOnce(ready).mockResolvedValueOnce(newReady);
    const view = open();
    await act(() => view.result.current.generate(input, profile));
    const dismissPrevious = view.result.current.discardDraft;
    await act(() => view.result.current.generate(newInput, profile));

    act(dismissPrevious);
    expect(view.result.current.visible?.receipt.id).toBe(newReady.id);
    act(view.result.current.discardDraft);
    await waitFor(() => expect(view.result.current.visible).toBeNull());
    expect(cvRecoveryKeys(owner)).toEqual([]);
    expect(startCvGeneration).toHaveBeenCalledTimes(2);
  });

  it.each([1, 2])("uses the current parent revision %i to decide whether to replace the draft", async (revision) => {
    const original = { ...ready, review: { revision: 1, included_fact_ids: [], evidence: [] } };
    vi.mocked(startCvGeneration).mockResolvedValue(original);
    const view = open();
    await act(() => view.result.current.generate(input, profile));
    const base = view.result.current.visible;
    if (!base) throw new Error("Expected the original draft to be visible");
    const proposal = {
      intent: { ...base.intent, request_key: oldKey },
      receipt: {
        ...original,
        id: newReady.id,
        edit: { base_generation_id: original.id, base_revision: 1 },
      },
    };

    vi.mocked(readCvGeneration).mockResolvedValueOnce({ ...original, review: { ...original.review, revision } });
    const expected = revision === 1 ? "applied" : "stale";
    await act(async () => {
      expect(await view.result.current.applyEdit(base, proposal)).toBe(expected);
    });
    expect(view.result.current.visible?.receipt.id).toBe(revision === 1 ? proposal.receipt.id : original.id);
    expect(cvRecoveryKeys(owner)).toEqual([revision === 1 ? oldKey : base.intent.request_key]);
    expect(startCvGeneration).toHaveBeenCalledOnce();
  });
});
