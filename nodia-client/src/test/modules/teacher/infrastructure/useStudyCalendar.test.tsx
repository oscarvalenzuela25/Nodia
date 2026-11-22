import type { PropsWithChildren } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStudyCalendarPlans, useStudyCalendarWrites } from "../../../../modules/teacher/infrastructure/useStudyCalendar";
import type { CalendarPlanStatus, CalendarSummary } from "../../../../modules/teacher/infrastructure/studyCalendar";
import type { StudyCalendarImportPlan } from "../../../../modules/teacher/infrastructure/studyCalendarImport";

const stub = vi.hoisted(() => ({
  actor: { user: { id: "1" }, sessionVersion: 1, sessionStatus: "authenticated", active: true },
  read: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), success: vi.fn(), notifyError: vi.fn(),
}));
vi.mock("../../../../store/authStore", () => ({
  default: Object.assign(<T,>(selector: (state: typeof stub.actor) => T) => selector(stub.actor), { getState: () => stub.actor }),
  hasActiveSession: (state: typeof stub.actor) => state.active,
}));
vi.mock("../../../../config/api", () => ({ mainInstance: { post: stub.post, patch: stub.patch, delete: stub.delete } }));
vi.mock("../../../../modules/teacher/infrastructure/services", () => ({
  readTeacherData: stub.read, closeTeacherRequest: vi.fn(), readTeacher: vi.fn(), readTeacherReceipt: vi.fn(), sendTeacher: vi.fn(),
}));
vi.mock("sileo", () => ({ sileo: { success: stub.success, error: vi.fn() } }));
vi.mock("../../../../config/httpFeedback", () => ({ notifyHttpError: stub.notifyError }));

beforeEach(() => {
  vi.resetAllMocks();
  stub.actor.user.id = "1";
  stub.actor.sessionVersion = 1;
  stub.actor.active = true;
});

const planId = "10000000-0000-4000-8000-000000000001";
const siblingId = "10000000-0000-4000-8000-000000000002";
const dayId = "20000000-0000-4000-8000-000000000001";
const categoryId = "30000000-0000-4000-8000-000000000001";
const oldCategory = { id: categoryId, name: "Idiomas", color: "blue" as const, active: true };
const summary: CalendarSummary = {
  id: planId, title: "Inglés", active: true, schedule: { kind: "numbered", days: 1 }, categories: [oldCategory],
  day_count: 1, completed_count: 0,
};
const sibling = { ...summary, id: siblingId, title: "Lectura", categories: [] };
const daySummary = {
  id: dayId, ordinal: 1, date: null, title: null, minutes: 30, activity_count: 0,
  completed_activity_count: 0, completed: false,
};
const day = { ...daySummary, notes: null, revision: 1, activities: [] };
const detail = { ...summary, days: [daySummary] };
const owner = ["teacher", "1", 1] as const;
const planKey = [...owner, "calendar/plans/" + planId, undefined] as const;
const dayKey = [...owner, "calendar/plans/" + planId + "/days/" + dayId, undefined] as const;
const otherOwnerPlanKey = ["teacher", "2", 2, planKey[3], undefined] as const;
const otherOwnerDayKey = ["teacher", "2", 2, dayKey[3], undefined] as const;
const siblingKey = [...owner, "calendar/plans/" + siblingId, undefined] as const;
const categoriesKey = [...owner, "calendar/categories", undefined] as const;
const listKey = (status: CalendarPlanStatus, category?: string) =>
  [...owner, "calendar/plans", { page: 1, category_id: category, status }] as const;
const page = (data: CalendarSummary[]) => ({ data, meta: { page: 1, total_pages: 1, total: data.length } });

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

describe("study calendar plan reads", () => {
  it("sends the filter and page together, with separate cache entries for each status", async () => {
    const { client, wrapper } = setup();
    stub.read.mockResolvedValueOnce(page([summary])).mockResolvedValueOnce(page([]));
    const hook = renderHook(({ status }: { status: CalendarPlanStatus }) => useStudyCalendarPlans(1, categoryId, status, true), {
      wrapper, initialProps: { status: "active" },
    });

    await waitFor(() => expect(hook.result.current.data?.data).toEqual([summary]));
    expect(stub.read).toHaveBeenLastCalledWith("calendar/plans", expect.any(AbortSignal), { page: 1, category_id: categoryId, status: "active" });
    hook.rerender({ status: "inactive" });

    await waitFor(() => expect(hook.result.current.data?.data).toEqual([]));
    expect(stub.read).toHaveBeenLastCalledWith("calendar/plans", expect.any(AbortSignal), { page: 1, category_id: categoryId, status: "inactive" });
    expect(client.getQueryData(listKey("active", categoryId))).toEqual(page([summary]));
    expect(client.getQueryData(listKey("inactive", categoryId))).toEqual(page([]));
  });
});

describe("study calendar plan changes", () => {
  it("refreshes confirmed plan data and removes it from list filters it no longer matches", async () => {
    const { client, wrapper } = setup();
    client.setQueryData(planKey, detail);
    client.setQueryData(dayKey, day);
    client.setQueryData(categoriesKey, [oldCategory]);
    client.setQueryData(listKey("active"), page([summary, sibling]));
    client.setQueryData(listKey("all"), page([summary, sibling]));
    client.setQueryData(listKey("all", categoryId), page([summary]));
    client.setQueryData(otherOwnerPlanKey, detail);
    let finishPreviousRead: (value: ReturnType<typeof page>) => void = () => {};
    const delayedRead = vi.fn(() => new Promise<ReturnType<typeof page>>(resolve => { finishPreviousRead = resolve; }));
    const previousRead = client.fetchQuery({ queryKey: listKey("active"), queryFn: delayedRead }).catch(() => undefined);
    await waitFor(() => expect(delayedRead).toHaveBeenCalledOnce());
    const patch = { title: "Inglés actualizado", active: false, category_ids: [] };
    const saved = { ...summary, title: patch.title, active: false, categories: [] };
    const savedDetail = { ...saved, days: [daySummary] };
    stub.patch.mockResolvedValueOnce({ data: savedDetail });
    const { result } = renderHook(() => useStudyCalendarWrites(), { wrapper });

    await act(async () => { expect(await result.current.patchPlan(planId, patch)).toBe(true); });
    finishPreviousRead(page([summary, sibling]));
    await previousRead;

    expect(stub.patch).toHaveBeenCalledExactlyOnceWith("/teacher/calendar/plans/" + planId, patch);
    expect(client.getQueryData(planKey)).toEqual(savedDetail);
    expect(client.getQueryData(listKey("active"))).toEqual({ ...page([summary, sibling]), data: [sibling] });
    expect(client.getQueryData(listKey("all"))).toMatchObject({ data: [saved, sibling] });
    expect(client.getQueryData(listKey("all", categoryId))).toMatchObject({ data: [] });
    expect(client.getQueryState(listKey("active"))?.isInvalidated).toBe(true);
    expect(client.getQueryState(categoriesKey)?.isInvalidated).toBe(false);
    expect(client.getQueryData(dayKey)).toEqual(day);
    expect(client.getQueryData(otherOwnerPlanKey)).toEqual(detail);
  });

  it("keeps cached plan, days and lists on a failed or unconfirmed deletion, then purges only the confirmed plan", async () => {
    const { client, wrapper } = setup();
    for (const key of [planKey, siblingKey, otherOwnerPlanKey]) client.setQueryData(key, detail);
    for (const key of [dayKey, otherOwnerDayKey]) client.setQueryData(key, day);
    client.setQueryData(listKey("active"), page([summary, sibling]));
    client.setQueryData(listKey("all"), page([summary, sibling]));
    const networkError = new Error("Synthetic connection failure");
    stub.delete.mockRejectedValueOnce(networkError).mockResolvedValueOnce({ status: 200 }).mockResolvedValueOnce({ status: 204 });
    const { result } = renderHook(() => useStudyCalendarWrites(), { wrapper });

    await act(async () => { await expect(result.current.deletePlan(planId)).rejects.toBe(networkError); });
    expect(stub.delete).toHaveBeenCalledExactlyOnceWith("/teacher/calendar/plans/" + planId);
    await act(async () => { await expect(result.current.deletePlan(planId)).rejects.toThrow("calendar_plan_delete_unconfirmed"); });
    expect(stub.notifyError).toHaveBeenCalledTimes(2);
    expect(stub.success).not.toHaveBeenCalled();
    expect(client.getQueryData(planKey)).toEqual(detail);
    expect(client.getQueryData(dayKey)).toEqual(day);
    expect(client.getQueryData(listKey("active"))).toEqual(page([summary, sibling]));

    await act(async () => { expect(await result.current.deletePlan(planId)).toBe(true); });
    expect(stub.success).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(planKey)).toBeUndefined();
    expect(client.getQueryData(dayKey)).toBeUndefined();
    expect(client.getQueryData(siblingKey)).toEqual(detail);
    expect(client.getQueryData(otherOwnerPlanKey)).toEqual(detail);
    expect(client.getQueryData(otherOwnerDayKey)).toEqual(day);
    expect(client.getQueryData(listKey("active"))).toMatchObject({ data: [sibling] });
    expect(client.getQueryData(listKey("all"))).toMatchObject({ data: [sibling] });
  });

  it("does not apply a late deletion acknowledgement to the current actor after switching accounts", async () => {
    const { client, wrapper } = setup();
    client.setQueryData(planKey, detail);
    client.setQueryData(otherOwnerPlanKey, detail);
    let complete: (response: { status: number }) => void = () => {};
    stub.delete.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const { result, rerender } = renderHook(() => useStudyCalendarWrites(), { wrapper });
    let deleting: Promise<boolean> = Promise.resolve(false);

    act(() => { deleting = result.current.deletePlan(planId); });
    await waitFor(() => expect(stub.delete).toHaveBeenCalledOnce());
    stub.actor.user.id = "2";
    stub.actor.sessionVersion = 2;
    rerender();
    await act(async () => { complete({ status: 204 }); expect(await deleting).toBe(false); });

    expect(stub.success).not.toHaveBeenCalled();
    expect(stub.notifyError).not.toHaveBeenCalled();
    expect(client.getQueryData(planKey)).toEqual(detail);
    expect(client.getQueryData(otherOwnerPlanKey)).toEqual(detail);
  });

  it("clears an uncertain create on the terminal deleted-plan replay, without replaying under a new key", async () => {
    const { wrapper } = setup();
    const plan: StudyCalendarImportPlan = { version: 1, title: summary.title, schedule: summary.schedule };
    const terminal = { isAxiosError: true, response: { status: 410, data: { code: "calendar_plan_deleted" } } };
    stub.post.mockRejectedValueOnce(new Error("Synthetic timeout")).mockRejectedValueOnce(terminal);
    const { result } = renderHook(() => useStudyCalendarWrites(), { wrapper });

    await act(async () => { await expect(result.current.create(plan)).rejects.toThrow("Synthetic timeout"); });
    expect(result.current.uncertain).toBe(true);
    await act(async () => { await expect(result.current.retryCreate()).rejects.toBe(terminal); });

    expect(result.current.uncertain).toBe(false);
    expect(stub.post).toHaveBeenCalledTimes(2);
    expect(stub.post.mock.calls[1]).toEqual(stub.post.mock.calls[0]);
    await act(async () => { expect(await result.current.retryCreate()).toBeNull(); });
    expect(stub.post).toHaveBeenCalledTimes(2);
  });
});
