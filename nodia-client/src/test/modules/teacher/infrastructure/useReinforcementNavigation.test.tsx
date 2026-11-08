import type { PropsWithChildren } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useAuthStore from "../../../../store/authStore";
import { readTeacherData } from "../../../../modules/teacher/infrastructure/services";
import { notifyHttpError } from "../../../../config/httpFeedback";
import { openReinforcementUnit, useReinforcementNavigation } from "../../../../modules/teacher/infrastructure/useReinforcementNavigation";
import { reinforcementSchema, type Cursor, type Material, type Reinforcement } from "../../../../modules/teacher/infrastructure/schemas";

vi.mock("../../../../modules/teacher/infrastructure/services", () => ({ readTeacherData: vi.fn() }));
vi.mock("../../../../config/httpFeedback", () => ({ notifyHttpError: vi.fn() }));

const projection: Reinforcement = { plan_revision_id: "plan", section_id: "section", navigation: "current_plan", objectives: [{ objective_id: "records", description: "Records", earned_points: 0, possible_points: 4, units: [{ unit_id: "unit2", title: "Records" }] }] };
const cursor: Cursor = { revision: 3, phase: "final", plan_revision_id: "plan", section_id: "section", unit_id: null, content_version_id: null, attempt_id: "final", item_id: "question12", block_id: null };
const material: Material = { kind: "material", resource_id: "content", content_version_id: "content", plan_revision_id: "plan", unit_id: "unit2", blocks: [{ id: "block1", title: "Records", body_markdown: "Synthetic fixture" }], allowed_actions: {} };
const input = { projection, currentPlanId: "plan", unitId: "unit2", cursor };

function deferred<T>() { let resolve: (value: T) => void = () => {}; const promise = new Promise<T>(value => { resolve = value; }); return { promise, resolve }; }
const clients: QueryClient[] = [];
function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  return ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => { vi.resetAllMocks(); useAuthStore.setState({ user: { id: "synthetic", name: "Synthetic" }, sessionVersion: 1, sessionStatus: "authenticated" }); });
afterEach(() => { clients.splice(0).forEach(client => client.clear()); });

describe("Teacher authoritative reinforcement navigation", () => {
  it("looks up real content and waits for the cursor ACK before leaving the final result", async () => {
    const receipt = deferred<{ revision: number }>(); const save = vi.fn(() => receipt.promise);
    let completed = false;
    const pending = openReinforcementUnit(input, { read: async () => material, save, current: () => true }).then(value => { completed = true; return value; });
    await Promise.resolve();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ phase: "theory", unit_id: "unit2", content_version_id: "content", block_id: "block1", attempt_id: null, item_id: null }));
    expect(completed).toBe(false); receipt.resolve({ revision: 4 });
    expect(await pending).toMatchObject({ unit_id: "unit2", phase: "theory" });
  });
  it("opens availability without generating material and never routes historical, wrong-plan or unrelated targets", async () => {
    const save = vi.fn(async () => ({ revision: 4 })); const read = vi.fn(async (): Promise<Material> => ({ kind: "availability", state: "not_prepared", job_id: null }));
    expect(await openReinforcementUnit(input, { read, save, current: () => true })).toMatchObject({ phase: "setup", content_version_id: null, block_id: null });
    for (const change of [{ currentPlanId: "new-plan" }, { unitId: "wrong-unit" }, { projection: { ...projection, navigation: "history_only" as const } }]) {
      read.mockClear(); save.mockClear(); expect(await openReinforcementUnit({ ...input, ...change }, { read, save, current: () => true })).toBeNull();
      expect(read).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
    }
  });
  it("leaves the result intact on failed cursor save, invalid material identity or changed context", async () => {
    const save = vi.fn(async () => null);
    expect(await openReinforcementUnit(input, { read: async () => material, save, current: () => true })).toBeNull();
    save.mockClear();
    expect(await openReinforcementUnit(input, { read: async () => ({ ...material, unit_id: "other" }), save, current: () => true })).toBeNull();
    expect(await openReinforcementUnit(input, { read: async () => material, save, current: () => false })).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });
  it("preserves real zero but rejects invalid or fabricated recommendation scores", () => {
    expect(reinforcementSchema.parse(projection).objectives[0].earned_points).toBe(0);
    expect(reinforcementSchema.safeParse({ ...projection, objectives: [{ ...projection.objectives[0], earned_points: 4 }] }).success).toBe(false);
    expect(reinforcementSchema.safeParse({ ...projection, navigation: "guess" }).success).toBe(false);
  });
  it("keeps a failed lookup recoverable with a local retry and one error notification", async () => {
    const failure = new Error("Synthetic unavailable"); vi.mocked(readTeacherData).mockRejectedValueOnce(failure).mockResolvedValueOnce(material);
    const save = vi.fn(async () => ({ revision: 4 })); const { result } = renderHook(() => useReinforcementNavigation("session", "plan:final:active"), { wrapper: wrapper() });
    await act(async () => { expect(await result.current.open(input, save)).toBeNull(); });
    expect(result.current.failed).toBe(true); expect(save).not.toHaveBeenCalled(); expect(notifyHttpError).toHaveBeenCalledWith(failure);
    await act(async () => { expect(await result.current.open(input, save)).toMatchObject({ unit_id: "unit2" }); });
    expect(result.current.failed).toBe(false); expect(save).toHaveBeenCalledTimes(1);
  });
  it("keeps an unconfirmed outline cursor local and retries only after an explicit known recovery", async () => {
    const save = vi.fn<() => Promise<{ revision: number } | null>>().mockResolvedValueOnce(null).mockResolvedValueOnce({ revision: 4 });
    const { result } = renderHook(() => useReinforcementNavigation("session", "plan:final:active"), { wrapper: wrapper() });
    const outlineCursor: Cursor = { ...cursor, phase: "setup", attempt_id: null, item_id: null };
    await act(async () => { expect(await result.current.choose(outlineCursor, save)).toBeNull(); });
    expect(result.current.failed).toBe(true); expect(save).toHaveBeenCalledTimes(1);
    // Recovery/command admission owns when another explicit action becomes available.
    await act(async () => { expect(await result.current.choose(outlineCursor, save)).toEqual(outlineCursor); });
    expect(save).toHaveBeenCalledTimes(2); expect(readTeacherData).not.toHaveBeenCalled();
  });
  it.each(["pause", "plan", "actor", "unmount"])("discards a late lookup after %s without writing a cursor", async mode => {
    const lookup = deferred<Material>(); vi.mocked(readTeacherData).mockReturnValue(lookup.promise);
    const save = vi.fn(async () => ({ revision: 4 })); const hook = renderHook(({ context }) => useReinforcementNavigation("session", context), { wrapper: wrapper(), initialProps: { context: "plan:final:active" } });
    let pending: Promise<Cursor | null> = Promise.resolve(null);
    act(() => { pending = hook.result.current.open(input, save); });
    expect(hook.result.current.pending).toBe(true);
    if (mode === "actor") act(() => { useAuthStore.setState({ sessionVersion: 2 }); });
    else if (mode === "unmount") hook.unmount();
    else hook.rerender({ context: mode === "pause" ? "plan:final:paused" : "new-plan:final:active" });
    await act(async () => { lookup.resolve(material); expect(await pending).toBeNull(); });
    expect(save).not.toHaveBeenCalled(); expect(notifyHttpError).not.toHaveBeenCalled();
  });
});
