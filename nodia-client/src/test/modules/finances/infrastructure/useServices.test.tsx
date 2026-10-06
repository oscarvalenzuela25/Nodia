import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { ZodError } from "zod";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sileo } from "sileo";
import useAuthStore from "../../../../store/authStore";
import {
  financeKeys,
  isFinanceWriteUncertain,
  useFinanceList,
  useFinanceMutation,
  useFinanceOptions,
} from "../../../../modules/finances/infrastructure/useServices";
import * as services from "../../../../modules/finances/infrastructure/services";
import type {
  FinanceCategory,
  FinancePage,
} from "../../../../modules/finances/types";

vi.mock("../../../../modules/finances/infrastructure/services", () => ({
  getFinanceList: vi.fn(),
  getFinanceRecord: vi.fn(),
  getFinanceOverview: vi.fn(),
  getFinanceSummary: vi.fn(),
  saveFinanceRecord: vi.fn(),
}));
vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));
const record: FinanceCategory = {
  id: "1",
  user_id: "42",
  name: "Food",
  key: "food",
  is_active: true,
  created_at: "2026-10-04T03:00:00.000Z",
  updated_at: "2026-10-04T03:00:00.000Z",
};
const page: FinancePage<FinanceCategory> = {
  data: [record],
  meta: { page: 1, limit: 10, total_items: 1, total_pages: 1 },
};
const clients: QueryClient[] = [];
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}
const signIn = (id = "42") =>
  useAuthStore
    .getState()
    .login({
      token: "fixture",
      expiresAt: Date.now() + 900000,
      user: { id, name: "Fixture" },
    });
beforeEach(() => {
  vi.clearAllMocks();
  signIn();
  vi.mocked(services.getFinanceList).mockResolvedValue(page);
  vi.mocked(services.saveFinanceRecord).mockResolvedValue(record);
});
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
  useAuthStore.getState().logout();
});

describe("finance queries", () => {
  it("disables reads without an authenticated principal", () => {
    useAuthStore.getState().logout();
    const { wrapper } = setup();
    renderHook(() => useFinanceList("categories", {}), { wrapper });
    expect(services.getFinanceList).not.toHaveBeenCalled();
  });
  it("preserves same-user data while changing page but never carries it across users", async () => {
    const { wrapper } = setup();
    const hook = renderHook(
      ({ currentPage }) => useFinanceList("categories", { page: currentPage }),
      { wrapper, initialProps: { currentPage: 1 } },
    );
    await waitFor(() =>
      expect(hook.result.current.data?.data[0]?.name).toBe("Food"),
    );
    vi.mocked(services.getFinanceList).mockImplementation(
      () => new Promise(() => undefined),
    );
    hook.rerender({ currentPage: 2 });
    expect(hook.result.current.data?.data[0]?.name).toBe("Food");
    expect(hook.result.current.isPlaceholderData).toBe(true);
    act(() => signIn("84"));
    expect(hook.result.current.data).toBeUndefined();
    expect(hook.result.current.isPlaceholderData).toBe(false);
  });
  it("loads remote options with bounded pages, server search and the chosen visibility", async () => {
    vi.mocked(services.getFinanceList)
      .mockResolvedValueOnce({
        ...page,
        meta: { page: 1, limit: 20, total_items: 21, total_pages: 2 },
      })
      .mockResolvedValueOnce({
        ...page,
        meta: { page: 2, limit: 20, total_items: 21, total_pages: 2 },
      });
    const { wrapper } = setup();
    const hook = renderHook(
      () => useFinanceOptions("categories", "  Food  ", true, "all"),
      { wrapper },
    );
    await waitFor(() => expect(hook.result.current.hasNextPage).toBe(true));
    await act(() => hook.result.current.fetchNextPage());
    expect(services.getFinanceList).toHaveBeenNthCalledWith(
      2,
      "categories",
      { page: 2, limit: 20, active: "all", q: { name_cont: "Food" } },
      expect.any(AbortSignal),
    );
    await waitFor(() => expect(hook.result.current.hasNextPage).toBe(false));
  });
});

describe("finance mutations", () => {
  it("invalidates only the current user after one confirmed write and emits a success toast", async () => {
    const { client, wrapper } = setup();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const hook = renderHook(() => useFinanceMutation("categories"), {
      wrapper,
    });
    await act(() =>
      hook.result.current.mutateAsync({ data: { name: "Food", key: "food" } }),
    );
    expect(services.saveFinanceRecord).toHaveBeenCalledOnce();
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: financeKeys.scope("42"),
    });
    expect(sileo.success).toHaveBeenCalledOnce();
  });
  it("does not retry an uncertain write and requires a successful read before resetting uncertainty", async () => {
    vi.mocked(services.saveFinanceRecord).mockRejectedValue(
      new AxiosError("Disconnected", "ERR_NETWORK"),
    );
    const { client, wrapper } = setup();
    const invalidate = vi
      .spyOn(client, "invalidateQueries")
      .mockRejectedValueOnce(new Error("Read failed"))
      .mockResolvedValueOnce();
    const hook = renderHook(() => useFinanceMutation("categories"), {
      wrapper,
    });
    await act(async () => {
      await expect(
        hook.result.current.mutateAsync({
          data: { name: "Food", key: "food" },
        }),
      ).rejects.toThrow();
    });
    await waitFor(() => expect(hook.result.current.isUncertain).toBe(true));
    expect(services.saveFinanceRecord).toHaveBeenCalledOnce();
    await act(async () => {
      await expect(hook.result.current.reviewResult()).rejects.toThrow(
        "Read failed",
      );
    });
    expect(hook.result.current.isUncertain).toBe(true);
    await act(() => hook.result.current.reviewResult());
    await waitFor(() => expect(hook.result.current.isUncertain).toBe(false));
    expect(invalidate).toHaveBeenLastCalledWith(
      { queryKey: financeKeys.scope("42") },
      { throwOnError: true },
    );
    expect(services.saveFinanceRecord).toHaveBeenCalledOnce();
  });
  it("does not notify or invalidate the new user when an earlier session write completes", async () => {
    let finish!: (record: FinanceCategory) => void;
    vi.mocked(services.saveFinanceRecord).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { client, wrapper } = setup();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const hook = renderHook(() => useFinanceMutation("categories"), {
      wrapper,
    });
    let pending!: Promise<FinanceCategory>;
    act(() => {
      pending = hook.result.current.mutateAsync({
        data: { name: "Food", key: "food" },
      });
    });
    await waitFor(() => expect(finish).toBeDefined());
    act(() => signIn("84"));
    await act(async () => {
      finish(record);
      await pending;
    });
    expect(invalidate).not.toHaveBeenCalled();
    expect(sileo.success).not.toHaveBeenCalled();
  });
  it("classifies transport and response validation failures separately from server rejections", () => {
    expect(
      isFinanceWriteUncertain(new AxiosError("Network", "ERR_NETWORK")),
    ).toBe(true);
    expect(isFinanceWriteUncertain(new ZodError([]))).toBe(true);
    expect(
      isFinanceWriteUncertain(new AxiosError("Cancelled", "ERR_CANCELED")),
    ).toBe(false);
    const rejected = new AxiosError("Conflict", "ERR_BAD_RESPONSE");
    rejected.response = {
      data: { message: "finance:overpayment" },
      status: 409,
      statusText: "Conflict",
      headers: {},
      config: { headers: {} as never },
    };
    expect(isFinanceWriteUncertain(rejected)).toBe(false);
  });
});
