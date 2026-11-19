import type { PropsWithChildren } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mainInstance } from "../../../../../config/api";
import useAuthStore from "../../../../../store/authStore";
import { currentPersonalNewsActor } from "../../../../../modules/news/components/PersonalNews/services";
import { usePersonalNews } from "../../../../../modules/news/components/PersonalNews/usePersonalNews";
import type { PersonalConnection, PersonalProvider } from "../../../../../modules/news/components/PersonalNews/types";

vi.mock("../../../../../config/api", () => ({ mainInstance: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));

const dev = "dev-community";
const daily = "daily-dev";
const connection: PersonalConnection = {
  provider: dev,
  state: "connected",
  account_name: "synthetic-account",
  key_hint: "••••••••",
  last_tested_at: "2026-11-18T11:58:00Z",
  last_test_error_code: null,
  last_refresh_attempt_at: null,
  last_refresh_success_at: null,
  last_refresh_error_code: null,
  next_refresh_at: null,
  retry_source: null,
  snapshot_status: null,
};
const pending: PersonalConnection = { ...connection, provider: daily, state: "pending", account_name: null, key_hint: null };
const dailyConnection: PersonalConnection = { ...connection, provider: daily, account_name: "daily-test-account" };
const oldArticles = { items: [{ id: "synthetic-123", provider: dev, title: "Old synthetic result", url: "https://example.test/old", published_at: null }] };
const dailyArticles = { items: [{ id: "daily-123", provider: daily, title: "Daily synthetic result", url: "https://example.test/daily", published_at: null }] };

function mockAvailableSources(connections: PersonalConnection[]) {
  vi.mocked(mainInstance.get).mockImplementation(async (url, config) => {
    if (url.endsWith("/connections")) return { data: { connections } };
    const params = config?.params;
    const provider = params && typeof params === "object" && "provider" in params ? params.provider : undefined;
    return { data: provider === daily ? dailyArticles : oldArticles };
  });
}

let client: QueryClient;
const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
const login = (id: string) => useAuthStore.getState().login({
  token: "synthetic-session", expiresAt: Date.now() + 60_000, user: { id, name: "Synthetic account" },
});

beforeEach(() => {
  vi.resetAllMocks();
  login("42");
  client = new QueryClient();
  mockAvailableSources([connection, pending]);
});
afterEach(() => {
  client.clear();
  useAuthStore.getState().logout();
});

describe("Personal News session and cache", () => {
  it("keeps the credential out of the mutation cache and discards the previous provider snapshot after replacement", async () => {
    const actor = currentPersonalNewsActor()!;
    const { result } = renderHook(() => usePersonalNews(actor), { wrapper });
    await waitFor(() => expect(result.current.articles.data).toEqual(oldArticles));
    expect(mainInstance.post).not.toHaveBeenCalled();
    let resolve!: (response: { data: { connection: PersonalConnection } }) => void;
    vi.mocked(mainInstance.post).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    let request!: Promise<unknown>;
    act(() => { request = result.current.connect(dev, "synthetic-replacement"); });
    expect(client.getMutationCache().getAll()).toHaveLength(0);
    vi.mocked(mainInstance.get).mockImplementation(async (url) =>
      url.endsWith("/connections") ? { data: { connections: [connection, pending] } } : new Promise(() => undefined),
    );
    await act(async () => {
      resolve({ data: { connection } });
      await request;
    });
    expect(result.current.articles.data).toEqual({ items: [] });
    expect(client.getMutationCache().getAll()).toHaveLength(0);
  });

  it("removes the previous account's private cache as soon as the actor changes", async () => {
    const actor = currentPersonalNewsActor()!;
    const { result } = renderHook(() => usePersonalNews(actor), { wrapper });
    await waitFor(() => expect(result.current.articles.data).toEqual(oldArticles));
    act(() => login("43"));
    expect(client.getQueryCache().findAll({ queryKey: ["news-personal", actor] })).toHaveLength(0);
  });

  it("defaults to DEV with both connections and reads daily.dev only when selected", async () => {
    mockAvailableSources([dailyConnection, connection]);
    const actor = currentPersonalNewsActor()!;
    const { result, rerender } = renderHook(({ preferred }: { preferred?: PersonalProvider }) =>
      usePersonalNews(actor, preferred), { wrapper, initialProps: {} },
    );
    await waitFor(() => expect(result.current.articles.data).toEqual(oldArticles));
    expect(result.current.readingProvider).toBe(dev);
    const articleCalls = () => vi.mocked(mainInstance.get).mock.calls.filter(([url]) => url.endsWith("/articles"));
    expect(articleCalls()).toEqual([[expect.any(String), { params: { provider: dev }, signal: expect.any(AbortSignal) }]]);

    rerender({ preferred: daily });
    await waitFor(() => expect(result.current.articles.data).toEqual(dailyArticles));
    expect(result.current.readingProvider).toBe(daily);
    expect(articleCalls()).toHaveLength(2);
    expect(articleCalls()[1][1]?.params).toEqual({ provider: daily });
    expect(mainInstance.post).not.toHaveBeenCalled();
  });

  it("reads only daily.dev when it is the sole connection", async () => {
    mockAvailableSources([dailyConnection, { ...connection, state: "disconnected" }]);
    const { result } = renderHook(() => usePersonalNews(currentPersonalNewsActor()!, dev), { wrapper });
    await waitFor(() => expect(result.current.articles.data).toEqual(dailyArticles));
    expect(result.current.readingProvider).toBe(daily);
    expect(vi.mocked(mainInstance.get).mock.calls.map(([url, config]) =>
      [url.slice(url.lastIndexOf("/") + 1), config?.params],
    )).toEqual([["connections", undefined], ["articles", { provider: daily }]]);
  });

  it("does not load articles for a pending or disconnected provider", async () => {
    mockAvailableSources([pending, { ...connection, state: "disconnected" }]);
    const { result } = renderHook(() => usePersonalNews(currentPersonalNewsActor()!, daily), { wrapper });
    await waitFor(() => expect(result.current.connections.isSuccess).toBe(true));
    expect(result.current.readingProvider).toBeUndefined();
    expect(result.current.articles.fetchStatus).toBe("idle");
    expect(mainInstance.get).toHaveBeenCalledOnce();
  });
});
