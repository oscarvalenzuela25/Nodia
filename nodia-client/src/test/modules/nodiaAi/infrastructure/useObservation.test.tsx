import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { AxiosError, AxiosHeaders } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useAuthStore from "../../../../store/authStore";
import { mergeNodiaAiEvents, useNodiaAiEvents, useNodiaAiHistoricalRun, useNodiaAiObservation } from "../../../../modules/nodiaAi/infrastructure/useObservation";
import { chatId, messageId, run, runId } from "./fixtures";
import { acceptedEvent, observation, toolEvent, toolRef } from "./observationFixtures";

const mocks = vi.hoisted(() => ({ getNodiaAiEvents: vi.fn(), getNodiaAiObservation: vi.fn(), getNodiaAiRun: vi.fn(), error: vi.fn() }));
vi.mock("../../../../modules/nodiaAi/infrastructure/services", async importOriginal => ({ ...await importOriginal<object>(), ...mocks }));
vi.mock("../../../../config/httpFeedback", () => ({ notifyHttpError: mocks.error }));
let client: QueryClient;
function Wrapper({ children }: PropsWithChildren) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
function authenticate(id = "9", version = 1) { useAuthStore.setState({ user: { id, name: "Synthetic owner" }, token: "synthetic-only", expiresAt: Date.now() + 600000, sessionStatus: "authenticated", sessionVersion: version, isRefreshing: false }); }
const page = (items = [acceptedEvent], cursor: string | null = "synthetic-cursor-1") => ({ conversation_id: chatId, items, next_cursor: cursor, cursor_state: "current", has_more: false });
beforeEach(() => { vi.clearAllMocks(); client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); authenticate(); mocks.getNodiaAiEvents.mockResolvedValue(page()); });
afterEach(() => { cleanup(); client.clear(); useAuthStore.setState({ token: null, user: null, sessionStatus: "anonymous" }); });

describe("NodiaAI durable observation", () => {
  it("suspends hidden historical readers and refreshes the retained checkpoint once when reopened", async () => {
    mocks.getNodiaAiRun.mockResolvedValue({...run, state: "completed"});
    const {result, rerender} = renderHook(({observed}) => ({
      feed: useNodiaAiEvents(chatId, {...run, state: "completed"}, observed),
      historical: useNodiaAiHistoricalRun(chatId, runId, observed),
    }), {initialProps: {observed: false}, wrapper: Wrapper});
    expect(mocks.getNodiaAiEvents).not.toHaveBeenCalled();
    expect(mocks.getNodiaAiRun).not.toHaveBeenCalled();
    rerender({observed: true});
    await waitFor(() => expect(result.current.feed.isSuccess && result.current.historical.isSuccess).toBe(true));
    rerender({observed: false});
    await act(() => client.invalidateQueries({queryKey: ["nodia-ai", "9", 1]}));
    expect(result.current.feed.data?.items).toEqual([acceptedEvent]);
    expect(result.current.historical.data?.run_id).toBe(runId);
    expect(mocks.getNodiaAiEvents).toHaveBeenCalledTimes(1);
    expect(mocks.getNodiaAiRun).toHaveBeenCalledTimes(1);
    rerender({observed: true});
    await waitFor(() => expect(mocks.getNodiaAiEvents).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mocks.getNodiaAiRun).toHaveBeenCalledTimes(2));
    expect(mocks.getNodiaAiEvents.mock.calls[1][2]).toBe("synthetic-cursor-1");
  });
  it.each([401, 403, 404, 410])("retains a historical run on a transient outage and hides it after an explicit access rejection (%s)", async status => {
    const outage = new Error("offline");
    mocks.getNodiaAiRun.mockResolvedValueOnce({...run, state: "completed"}).mockRejectedValueOnce(outage);
    const {result} = renderHook(() => useNodiaAiHistoricalRun(chatId, runId), {wrapper: Wrapper});
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(() => result.current.refetch());
    await waitFor(() => {
      expect(result.current.error).toBe(outage);
      expect(result.current.isError).toBe(true);
      expect(result.current.isFetching).toBe(false);
    });
    expect(result.current.data?.run_id).toBe(runId);
    expect(result.current.accessRejected).toBe(false);
    const denied = Object.assign(new Error("denied"), {isAxiosError: true, response: {status}});
    mocks.getNodiaAiRun.mockRejectedValue(denied);
    await act(() => result.current.refetch());
    expect(client.getQueryData(["nodia-ai", "9", 1, "run", chatId, runId])).toBeNull();
    // Refetch settles before the batched Query observer notification necessarily
    // reaches React. Assert the committed rejection, not the prior outage render.
    await waitFor(() => {
      expect(result.current.error).toBe(denied);
      expect(result.current.accessRejected).toBe(true);
      expect(result.current.isError).toBe(true);
      expect(result.current.isFetching).toBe(false);
      expect(result.current.data).toBeUndefined();
    });
  });
  it("deduplicates by both durable ID and sequence, sorts bigint sequences and bounds the window", () => {
    expect(mergeNodiaAiEvents([toolEvent, acceptedEvent], [toolEvent, { ...acceptedEvent, event_id: runId }])).toEqual([acceptedEvent, toolEvent]);
    const events = Array.from({ length: 300 }, (_, index) => ({ ...acceptedEvent, event_id: `synthetic-${index}`, seq: String(9007199254741000n + BigInt(index)) }));
    expect(mergeNodiaAiEvents([], events)).toHaveLength(256);
    expect(mergeNodiaAiEvents([], events)[0].seq).toBe(events[44].seq);
  });
  it("keeps an independent checkpoint across empty pages and restores using reads only", async () => {
    mocks.getNodiaAiEvents.mockResolvedValueOnce(page()).mockResolvedValue(page([], "synthetic-cursor-2"));
    const first = renderHook(() => useNodiaAiEvents(chatId, { ...run, state: "completed" }), { wrapper: Wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    await act(() => first.result.current.refetch());
    expect(mocks.getNodiaAiEvents.mock.calls[1].slice(0, 3)).toEqual([runId, chatId, "synthetic-cursor-1"]);
    expect(first.result.current.data?.items).toEqual([acceptedEvent]);
    first.unmount();
    renderHook(() => useNodiaAiEvents(chatId, { ...run, state: "completed" }), { wrapper: Wrapper });
    await waitFor(() => expect(mocks.getNodiaAiEvents).toHaveBeenCalledTimes(3));
    expect(mocks.getNodiaAiEvents.mock.calls[2][2]).toBe("synthetic-cursor-2");
  });
  it("drains additional durable pages after a terminal run without restarting work", async () => {
    mocks.getNodiaAiEvents.mockResolvedValueOnce({ ...page(), has_more: true }).mockResolvedValue(page([toolEvent], "synthetic-cursor-2"));
    const { result } = renderHook(() => useNodiaAiEvents(chatId, { ...run, state: "completed" }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data?.items).toHaveLength(2));
    expect(mocks.getNodiaAiEvents).toHaveBeenCalledTimes(2);
    expect(mocks.getNodiaAiEvents.mock.calls[1][2]).toBe("synthetic-cursor-1");
  });
  it("drops references and refreshes the snapshot before recovering a stale authority cursor", async () => {
    mocks.getNodiaAiEvents.mockResolvedValueOnce(page([toolEvent])).mockResolvedValueOnce({ ...page([], null), cursor_state: "reset_required" }).mockResolvedValue(page([]));
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useNodiaAiEvents(chatId, { ...run, state: "completed" }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(() => result.current.refetch());
    expect(result.current.error).toBeNull();
    expect(mocks.getNodiaAiEvents).toHaveBeenCalledTimes(3);
    expect(client.getQueryData(["nodia-ai", "9", 1, "events", chatId, runId])).toMatchObject({items: []});
    await waitFor(() => expect(result.current.data?.items).toEqual([]));
    expect(mocks.getNodiaAiEvents.mock.calls[2][2]).toBeUndefined();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["nodia-ai", "9", 1, "detail", chatId] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["nodia-ai", "9", 1, "messages", chatId] });
  });
  it("isolates another account or run, including a late old-account response", async () => {
    const { result, rerender } = renderHook(({ selected }) => useNodiaAiEvents(chatId, selected), { initialProps: { selected: { ...run, state: "completed" as const } }, wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    mocks.getNodiaAiEvents.mockImplementation(() => new Promise(() => {}));
    act(() => authenticate("10", 2));
    expect(result.current.data).toBeUndefined();
    rerender({ selected: { ...run, run_id: messageId, state: "completed" } });
    expect(result.current.data).toBeUndefined();
  });
  it("notifies once per outage and preserves references through a transport error", async () => {
    const { result } = renderHook(() => useNodiaAiEvents(chatId, { ...run, state: "completed" }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    mocks.getNodiaAiEvents.mockRejectedValue(new Error("synthetic outage"));
    await act(() => result.current.refetch());
    await act(() => result.current.refetch());
    expect(result.current.data?.items).toEqual([acceptedEvent]);
    await waitFor(() => expect(mocks.error).toHaveBeenCalledTimes(1));
    mocks.getNodiaAiEvents.mockResolvedValue(page());
    await act(() => result.current.refetch());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    mocks.getNodiaAiEvents.mockRejectedValue(new Error("synthetic second outage"));
    await act(() => result.current.refetch());
    await waitFor(() => expect(mocks.error).toHaveBeenCalledTimes(2));
  });
  it("reads full observations on intent and hides cached content after an access rejection", async () => {
    mocks.getNodiaAiObservation.mockResolvedValue(observation);
    const { result, rerender } = renderHook(({ opened }) => useNodiaAiObservation(toolRef, opened), { initialProps: { opened: false }, wrapper: Wrapper });
    expect(mocks.getNodiaAiObservation).not.toHaveBeenCalled();
    rerender({ opened: true });
    await waitFor(() => expect(result.current.data?.summary.total).toBe(0));
    const config = { headers: new AxiosHeaders() };
    mocks.getNodiaAiObservation.mockRejectedValue(new AxiosError("Denied", "ERR_BAD_REQUEST", config, undefined, { config, data: {}, headers: {}, status: 403, statusText: "Forbidden" }));
    await act(() => result.current.refetch());
    await waitFor(() => expect(result.current.accessRejected).toBe(true));
    expect(result.current.data).toBeUndefined();
    expect(client.getQueryData(["nodia-ai", "9", 1, "observation", toolRef])).toBeNull();
  });
  it("removes all result references when reading the feed is no longer authorized", async () => {
    mocks.getNodiaAiEvents.mockResolvedValue(page([toolEvent]));
    const { result } = renderHook(() => useNodiaAiEvents(chatId, { ...run, state: "completed" }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data?.items).toHaveLength(1));
    const config = { headers: new AxiosHeaders() };
    mocks.getNodiaAiEvents.mockRejectedValue(new AxiosError("Denied", "ERR_BAD_REQUEST", config, undefined, { config, data: {}, headers: {}, status: 403, statusText: "Forbidden" }));
    await act(() => result.current.refetch());
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data?.items).toEqual([]);
  });
});
