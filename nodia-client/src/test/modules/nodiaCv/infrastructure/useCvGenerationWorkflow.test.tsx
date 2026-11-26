import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useAuthStore from "../../../../store/authStore";
import { restoreCvGeneration, startCvGeneration } from "../../../../modules/nodiaCv/infrastructure/generations";
import type { CvGeneration, CvGenerationInput } from "../../../../modules/nodiaCv/infrastructure/generationSchema";
import { emptyProfile, profileRecordSchema } from "../../../../modules/nodiaCv/infrastructure/profileSchema";
import { cvRecoveryKey } from "../../../../modules/nodiaCv/infrastructure/receiptStorage";
import { useCvGenerationWorkflow } from "../../../../modules/nodiaCv/infrastructure/useCvGenerationWorkflow";

vi.mock("../../../../modules/nodiaCv/infrastructure/generations", async (original) => ({
  ...await original<object>(),
  startCvGeneration: vi.fn(),
  restoreCvGeneration: vi.fn(),
  useCvGenerationStatus: () => ({ data: undefined, error: null }),
}));

const owner = "42";
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
  it("clears an already presented terminal draft on returning to Generate CV", async () => {
    vi.mocked(startCvGeneration).mockResolvedValue(ready);
    const view = open();
    act(() => view.result.current.generate(input, profile));
    await waitFor(() => expect(view.result.current.visible?.receipt.id).toBe(ready.id));
    expect(cvRecoveryKey(owner)).not.toBeNull();

    view.rerender({ active: false });
    view.rerender({ active: true });
    expect(view.result.current.visible).toBeNull();
    expect(view.result.current.restorable).toBeNull();
    expect(cvRecoveryKey(owner)).toBeNull();
    expect(startCvGeneration).toHaveBeenCalledOnce();
  });

  it("recovers queued work on demand by the original key without a second POST", async () => {
    vi.mocked(startCvGeneration).mockResolvedValue(queued);
    const view = open();
    act(() => view.result.current.generate(input, profile));
    await waitFor(() => expect(view.result.current.working).toBe(true));
    const [submitted] = vi.mocked(startCvGeneration).mock.calls[0];
    vi.mocked(restoreCvGeneration).mockResolvedValue({ profile, input: submitted, receipt: ready });

    view.rerender({ active: false });
    view.rerender({ active: true });
    expect(view.result.current.visible).toBeNull();
    expect(view.result.current.restorable).toBe(submitted.request_key);
    act(() => view.result.current.generate(input, profile));
    expect(startCvGeneration).toHaveBeenCalledOnce();

    await act(async () => { await view.result.current.recover(); });
    expect(restoreCvGeneration).toHaveBeenCalledExactlyOnceWith(submitted.request_key, 1, expect.any(AbortSignal));
    expect(view.result.current.visible?.receipt.id).toBe(ready.id);
    expect(startCvGeneration).toHaveBeenCalledOnce();
  });

  it("keeps remote unknown blocked after switching tabs, without resending", async () => {
    vi.mocked(startCvGeneration).mockResolvedValue({ ...queued, state: "unknown" });
    const view = open();
    act(() => view.result.current.generate(input, profile));
    await waitFor(() => expect(view.result.current.receipt?.state).toBe("unknown"));

    view.rerender({ active: false });
    view.rerender({ active: true });
    expect(view.result.current.receipt?.state).toBe("unknown");
    act(() => view.result.current.generate(input, profile));
    expect(cvRecoveryKey(owner)).not.toBeNull();
    expect(startCvGeneration).toHaveBeenCalledOnce();
  });
});
