import type { PropsWithChildren } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AxiosError } from "axios";
import { sileo } from "sileo";
import useAuthStore from "../../../../../../store/authStore";
import { useNews, useNewsRefresh } from "../../../../../../modules/news/pages/News/infrastructure/useServices";
import { getNews, refreshNews } from "../../../../../../modules/news/pages/News/infrastructure/services";
import { news, refreshed } from "../../../fixtures";
import type { NewsSourceKey } from "../../../../../../modules/news/types";

const permission = vi.hoisted(() => ({ roles: [] as string[] }));
vi.mock("../../../../../../services/authorizationService", () => ({ useAuthorizationContext: () => ({ data: { roles: permission.roles }, isFetching: false, isError: false }) }));
vi.mock("../../../../../../modules/news/pages/News/infrastructure/services", () => ({ getNews: vi.fn(), refreshNews: vi.fn() }));
vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));

let client: QueryClient;
const filters = { topic: "all", source: "all", order: "recent", page: 1 } as const;
const session = (id = "42") => ({ token: "synthetic-token", expiresAt: Date.now() + 900_000, user: { id, name: "Synthetic actor" } });
const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
beforeEach(() => { vi.clearAllMocks(); permission.roles = []; useAuthStore.getState().logout(); client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); vi.mocked(getNews).mockResolvedValue(news); });
afterEach(() => { client.clear(); useAuthStore.getState().logout(); });

describe("News explicit refresh and identity", () => {
  it.each(["anonymous", "ordinary"])("keeps %s reading free of upstream refresh", async (kind) => {
    if (kind === "ordinary") useAuthStore.getState().login(session());
    const { result } = renderHook(() => ({ query: useNews(filters), action: useNewsRefresh("go-blog") }), { wrapper });
    await waitFor(() => expect(result.current.query.data).toEqual(news));
    expect(result.current.action.canRefresh).toBe(false);
    act(() => result.current.action.refresh());
    expect(refreshNews).not.toHaveBeenCalled();
  });

  it("requires a deliberate admin action and blocks two synchronous attempts", async () => {
    permission.roles = ["super_admin"];
    useAuthStore.getState().login(session());
    let resolve!: (data: typeof refreshed) => void;
    vi.mocked(refreshNews).mockReturnValue(new Promise(done => { resolve = done; }));
    const { result } = renderHook(() => useNewsRefresh("go-blog"), { wrapper });
    expect(refreshNews).not.toHaveBeenCalled();
    act(() => { result.current.refresh(); result.current.refresh(); });
    await waitFor(() => expect(refreshNews).toHaveBeenCalledOnce());
    await act(async () => resolve(refreshed));
    await waitFor(() => expect(sileo.success).toHaveBeenCalledOnce());
  });

  it("does not assume a refresh source and ignores callbacks for an old selection", async () => {
    permission.roles = ["super_admin"];
    useAuthStore.getState().login(session());
    vi.mocked(refreshNews).mockResolvedValue({ ...refreshed, source_key: "rust-blog" });
    const { result, rerender } = renderHook(({ source }: { source: NewsSourceKey | null }) => useNewsRefresh(source), { wrapper, initialProps: { source: null as NewsSourceKey | null } });
    act(() => result.current.refresh());
    expect(refreshNews).not.toHaveBeenCalled();
    rerender({ source: "go-blog" });
    const oldRefresh = result.current.refresh;
    rerender({ source: "rust-blog" });
    act(() => oldRefresh());
    expect(refreshNews).not.toHaveBeenCalled();
    act(() => result.current.refresh());
    await waitFor(() => expect(refreshNews).toHaveBeenCalledExactlyOnceWith("rust-blog"));
  });

  it("refreshes Rust without changing the Go reading filter", async () => {
    permission.roles = ["super_admin"];
    useAuthStore.getState().login(session());
    vi.mocked(refreshNews).mockResolvedValue({ ...refreshed, source_key: "rust-blog" });
    const readFilters = { ...filters, source: "go-blog" as const };
    const { result } = renderHook(() => ({ query: useNews(readFilters), action: useNewsRefresh("rust-blog") }), { wrapper });
    await waitFor(() => expect(result.current.query.data).toEqual(news));
    act(() => result.current.action.refresh());
    await waitFor(() => expect(sileo.success).toHaveBeenCalledOnce());
    expect(refreshNews).toHaveBeenCalledExactlyOnceWith("rust-blog");
    expect(getNews).toHaveBeenCalledWith(readFilters, expect.any(AbortSignal));
    expect(result.current.query.data).toEqual(news);
  });

  it("does not attribute a late source error to a new selection", async () => {
    permission.roles = ["super_admin"];
    useAuthStore.getState().login(session());
    let reject!: (error: Error) => void;
    vi.mocked(refreshNews).mockReturnValue(new Promise((_, fail) => { reject = fail; }));
    const { result, rerender } = renderHook(({ source }: { source: NewsSourceKey }) => useNewsRefresh(source), { wrapper, initialProps: { source: "rust-blog" as NewsSourceKey } });
    act(() => result.current.refresh());
    await waitFor(() => expect(refreshNews).toHaveBeenCalledExactlyOnceWith("rust-blog"));
    rerender({ source: "go-blog" });
    await act(async () => reject(new Error("Synthetic Rust unavailable")));
    expect(result.current.failure).toBeNull();
    expect(sileo.error).not.toHaveBeenCalled();
    expect(sileo.success).not.toHaveBeenCalled();
    expect(refreshNews).toHaveBeenCalledOnce();
  });

  it("blocks a held action after role revocation", () => {
    permission.roles = ["super_admin"];
    useAuthStore.getState().login(session());
    const { result, rerender } = renderHook(() => useNewsRefresh("rust-blog"), { wrapper });
    const oldRefresh = result.current.refresh;
    permission.roles = [];
    rerender();
    act(() => oldRefresh());
    expect(refreshNews).not.toHaveBeenCalled();
  });

  it("retains cards and reports a server error once without retrying refresh", async () => {
    permission.roles = ["super_admin"];
    useAuthStore.getState().login(session());
    const error = new AxiosError("Synthetic unavailable");
    error.response = { data: { message: "news:source_unavailable" }, status: 503, statusText: "Unavailable", headers: {}, config: { headers: {} } } as NonNullable<AxiosError["response"]>;
    vi.mocked(refreshNews).mockRejectedValue(error);
    const { result } = renderHook(() => ({ query: useNews(filters), action: useNewsRefresh("go-blog") }), { wrapper });
    await waitFor(() => expect(result.current.query.data).toEqual(news));
    act(() => result.current.action.refresh());
    await waitFor(() => expect(result.current.action.failure).toContain("La fuente no está disponible"));
    expect(result.current.query.data).toEqual(news);
    expect(refreshNews).toHaveBeenCalledOnce();
    expect(sileo.error).toHaveBeenCalledOnce();
    expect(sileo.success).not.toHaveBeenCalled();
  });

  it.each(["logout", "replacement"])("ignores a late refresh response after %s", async (change) => {
    permission.roles = ["super_admin"];
    useAuthStore.getState().login(session());
    let resolve!: (data: typeof refreshed) => void;
    vi.mocked(refreshNews).mockReturnValue(new Promise(done => { resolve = done; }));
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useNewsRefresh("go-blog"), { wrapper });
    act(() => result.current.refresh());
    await waitFor(() => expect(refreshNews).toHaveBeenCalledOnce());
    act(() => { if (change === "logout") useAuthStore.getState().logout(); else useAuthStore.getState().login(session("43")); });
    await act(async () => resolve(refreshed));
    expect(sileo.success).not.toHaveBeenCalled();
    expect(sileo.error).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
    expect(result.current.failure).toBeNull();
  });
});
