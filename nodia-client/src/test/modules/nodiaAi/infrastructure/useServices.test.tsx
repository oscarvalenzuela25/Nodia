import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useAuthStore from "../../../../store/authStore";
import {
  useAdmitNodiaAiMessage, useCreateNodiaAiConversation, useNodiaAiConversation,
  useNodiaAiCatalog, useNodiaAiConversations, useNodiaAiMessages, useSetNodiaAiRouting,
  useUpdateNodiaAiConversation, useNodiaAiEligibility, isNodiaAiAccessDenied,
} from "../../../../modules/nodiaAi/infrastructure/useServices";
import { chatId, conversation, detail, messageId, run, selection } from "./fixtures";

const mocks = vi.hoisted(() => ({
  getNodiaAiConversations: vi.fn(), getNodiaAiCatalog: vi.fn(), getNodiaAiConversation: vi.fn(),
  getNodiaAiMessages: vi.fn(), getNodiaAiEligibility: vi.fn(), createNodiaAiConversation: vi.fn(),
  admitNodiaAiMessage: vi.fn(), setNodiaAiRouting: vi.fn(), setNodiaAiSelection: vi.fn(),
  updateNodiaAiConversation: vi.fn(),
  error: vi.fn(), success: vi.fn(),
}));
vi.mock("../../../../modules/nodiaAi/infrastructure/services", () => mocks);
vi.mock("../../../../config/httpFeedback", () => ({notifyHttpError: mocks.error}));
vi.mock("sileo", () => ({sileo: {success: mocks.success}}));

let client: QueryClient;
function Wrapper({ children }: PropsWithChildren) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
const authenticate = (id: string, version = 1) => useAuthStore.setState({user: {id, name: "Synthetic user"}, token: "synthetic-test-only", expiresAt: Date.now() + 600000, sessionStatus: "authenticated", sessionVersion: version, isRefreshing: false});

describe("NodiaAI data lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client = new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}});
    authenticate("9");
  });
  afterEach(() => { cleanup(); client.clear(); useAuthStore.setState({token: null, user: null, sessionStatus: "anonymous"}); vi.useRealTimers(); });

  it("keeps pagination server-side and isolates cached chats after an account/session change", async () => {
    mocks.getNodiaAiConversations.mockImplementation(async (params: {cursor?: string}) => ({items: [{...conversation, title: params.cursor ? "Older" : "Current"}], next_cursor: params.cursor ? null : "older-cursor"}));
    const {result} = renderHook(() => ({...useNodiaAiConversations({search: "synthetic", is_archived: false})}), {wrapper: Wrapper});
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(() => result.current.fetchNextPage());
    expect(mocks.getNodiaAiConversations.mock.calls[1][0]).toEqual({search: "synthetic", is_archived: false, cursor: "older-cursor"});
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    mocks.getNodiaAiConversations.mockImplementation(() => new Promise(() => {}));
    act(() => authenticate("10", 2));
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
  });

  it("preserves visible history during a failed refetch and recovers by reading only", async () => {
    const page = {conversation_id: chatId, items: [], next_cursor: null};
    mocks.getNodiaAiMessages.mockResolvedValueOnce(page).mockRejectedValueOnce(new Error("offline")).mockResolvedValue(page);
    const {result} = renderHook(() => useNodiaAiMessages(chatId), {wrapper: Wrapper});
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(() => result.current.refetch());
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data?.pages).toEqual([page]);
    expect(result.current.isLoading).toBe(false);
    await act(() => result.current.refetch());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.admitNodiaAiMessage).not.toHaveBeenCalled();
  });

  it("does not authorize draft restoration from cached detail after a remount", async () => {
    mocks.getNodiaAiConversation.mockResolvedValueOnce(detail);
    const first = renderHook(() => useNodiaAiConversation(chatId), {wrapper: Wrapper});
    await waitFor(() => expect(first.result.current.draftAuthorized).toBe(true));
    first.unmount();
    let resolve: (value: typeof detail) => void = () => {};
    mocks.getNodiaAiConversation.mockReturnValue(new Promise<typeof detail>(done => {resolve = done;}));
    const second = renderHook(() => useNodiaAiConversation(chatId), {wrapper: Wrapper});
    expect(second.result.current.data).toEqual(detail);
    expect(second.result.current.draftAuthorized).toBe(false);
    await act(async () => {resolve(detail);});
    await waitFor(() => expect(second.result.current.draftAuthorized).toBe(true));
    expect(mocks.admitNodiaAiMessage).not.toHaveBeenCalled();
  });

  it("revalidates draft authority on resume, retaining cache through transient errors without authorizing it", async () => {
    mocks.getNodiaAiConversation.mockResolvedValueOnce(detail);
    const view = renderHook(() => useNodiaAiConversation(chatId), {wrapper: Wrapper});
    await waitFor(() => expect(view.result.current.draftAuthorized).toBe(true));
    let reject: (error: Error) => void = () => {};
    mocks.getNodiaAiConversation.mockReturnValue(new Promise<typeof detail>((_, fail) => {reject = fail;}));
    act(() => window.dispatchEvent(new Event("blur")));
    expect(view.result.current.draftAuthorized).toBe(false);
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(mocks.getNodiaAiConversation).toHaveBeenCalledTimes(2));
    expect(view.result.current.draftAuthorized).toBe(false);
    await act(async () => {reject(new Error("Synthetic offline"));});
    await waitFor(() => expect(view.result.current.isError).toBe(true));
    expect(view.result.current.data).toEqual(detail);
    expect(view.result.current.draftAuthorized).toBe(false);
    mocks.getNodiaAiConversation.mockResolvedValue(detail);
    await act(() => view.result.current.refetch());
    await waitFor(() => expect(view.result.current.draftAuthorized).toBe(true));
    expect(mocks.admitNodiaAiMessage).not.toHaveBeenCalled();
  });

  it("does not let a GET started before suspension authorize a later resume", async () => {
    let oldResolve: (value: typeof detail) => void = () => {};
    let freshResolve: (value: typeof detail) => void = () => {};
    mocks.getNodiaAiConversation
      .mockReturnValueOnce(new Promise<typeof detail>(done => {oldResolve = done;}))
      .mockReturnValueOnce(new Promise<typeof detail>(done => {freshResolve = done;}));
    const view = renderHook(() => useNodiaAiConversation(chatId), {wrapper: Wrapper});
    act(() => window.dispatchEvent(new Event("blur")));
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(mocks.getNodiaAiConversation).toHaveBeenCalledTimes(2));
    await act(async () => {oldResolve(detail);});
    expect(view.result.current.draftAuthorized).toBe(false);
    await act(async () => {freshResolve(detail);});
    await waitFor(() => expect(view.result.current.draftAuthorized).toBe(true));
  });

  it("authorizes shared observers by reading again when their deduplicated GET began before the later mount", async () => {
    let resolve: (value: typeof detail) => void = () => {};
    let freshResolve: (value: typeof detail) => void = () => {};
    mocks.getNodiaAiConversation
      .mockReturnValueOnce(new Promise<typeof detail>(done => {resolve = done;}))
      .mockReturnValueOnce(new Promise<typeof detail>(done => {freshResolve = done;}));
    const first = renderHook(() => useNodiaAiConversation(chatId), {wrapper: Wrapper});
    const second = renderHook(() => useNodiaAiConversation(chatId), {wrapper: Wrapper});
    expect(first.result.current.draftAuthorized).toBe(false);
    expect(second.result.current.draftAuthorized).toBe(false);
    await act(async () => {resolve(detail);});
    await waitFor(() => expect(mocks.getNodiaAiConversation).toHaveBeenCalledTimes(2));
    expect(second.result.current.draftAuthorized).toBe(false);
    await act(async () => {freshResolve(detail);});
    await waitFor(() => expect(second.result.current.draftAuthorized).toBe(true));
    expect(first.result.current.draftAuthorized).toBe(true);
  });

  it("never treats a local cache update as a successful detail authorization", async () => {
    mocks.getNodiaAiConversation.mockReturnValue(new Promise(() => {}));
    const view = renderHook(() => useNodiaAiConversation(chatId), {wrapper: Wrapper});
    act(() => client.setQueryData(["nodia-ai", "9", 1, "detail", chatId], detail));
    await waitFor(() => expect(view.result.current.data).toEqual(detail));
    expect(view.result.current.draftAuthorized).toBe(false);
  });

  it("does not restore or read again while hidden and requires a fresh GET when visible", async () => {
    mocks.getNodiaAiConversation.mockResolvedValue(detail);
    const view = renderHook(() => useNodiaAiConversation(chatId), {wrapper: Wrapper});
    await waitFor(() => expect(view.result.current.draftAuthorized).toBe(true));
    const visibility = vi.spyOn(document, "visibilityState", "get");
    try {
      visibility.mockReturnValue("hidden");
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      expect(view.result.current.draftAuthorized).toBe(false);
      await act(async () => {await Promise.resolve();});
      expect(mocks.getNodiaAiConversation).toHaveBeenCalledTimes(1);
      let resolve: (value: typeof detail) => void = () => {};
      mocks.getNodiaAiConversation.mockReturnValue(new Promise<typeof detail>(done => {resolve = done;}));
      visibility.mockReturnValue("visible");
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      await waitFor(() => expect(mocks.getNodiaAiConversation).toHaveBeenCalledTimes(2));
      expect(view.result.current.draftAuthorized).toBe(false);
      await act(async () => {resolve(detail);});
      await waitFor(() => expect(view.result.current.draftAuthorized).toBe(true));
    } finally { visibility.mockRestore(); }
  });

  it("requires a new authorized GET when returning to a chat already read during this mount", async () => {
    const otherId = "44444444-4444-4444-8444-444444444444";
    const otherDetail = {...detail, conversation: {...conversation, conversation_id: otherId}};
    mocks.getNodiaAiConversation.mockImplementation(async (id: string) => id === chatId ? detail : otherDetail);
    const view = renderHook(({id}) => useNodiaAiConversation(id), {initialProps: {id: chatId}, wrapper: Wrapper});
    await waitFor(() => expect(view.result.current.draftAuthorized).toBe(true));
    view.rerender({id: otherId});
    await waitFor(() => expect(view.result.current.draftAuthorized).toBe(true));
    mocks.getNodiaAiConversation.mockRejectedValue(new Error("Synthetic transient outage on returning"));
    view.rerender({id: chatId});
    expect(view.result.current.draftAuthorized).toBe(false);
    await waitFor(() => expect(view.result.current.isError).toBe(true));
    expect(view.result.current.data).toEqual(detail);
    expect(view.result.current.draftAuthorized).toBe(false);
    mocks.getNodiaAiConversation.mockResolvedValue(detail);
    await act(() => view.result.current.refetch());
    await waitFor(() => expect(view.result.current.draftAuthorized).toBe(true));
  });

  it.each([401, 403, 404, 410])("discards private chat caches after HTTP %s without replaying or reloading", async status => {
    const page = {conversation_id: chatId, items: [{message_id: messageId, parts: [{kind: "text", text: "Private synthetic text"}]}], next_cursor: null};
    mocks.getNodiaAiConversation.mockResolvedValue(detail);
    mocks.getNodiaAiMessages.mockResolvedValue(page);
    const otherId = "44444444-4444-4444-8444-444444444444";
    client.setQueryData(["nodia-ai", "9", 1, "conversations", {}], {pages: [{items: [conversation, {...conversation, conversation_id: otherId}], next_cursor: null}], pageParams: [undefined]});
    client.setQueryData(["nodia-ai", "9", 1, "detail", otherId], {...detail, conversation: {...conversation, conversation_id: otherId}});
    const privateKeys = [
      ["nodia-ai", "9", 1, "events", chatId, run.run_id],
      ["nodia-ai", "9", 1, "attachment", chatId, messageId],
      ["nodia-ai", "9", 1, "proposal", chatId, {}],
      ["nodia-ai", "9", 1, "observation", {}],
      ["nodia-ai", "9", 1, "execution", messageId],
    ];
    for (const key of privateKeys) client.setQueryData(key, {synthetic: "private"});
    const {result} = renderHook(() => ({detail: useNodiaAiConversation(chatId), messages: useNodiaAiMessages(chatId)}), {wrapper: Wrapper});
    await waitFor(() => expect(result.current.detail.isSuccess && result.current.messages.isSuccess).toBe(true));
    const error = Object.assign(new Error("denied"), {isAxiosError: true, response: {status}});
    mocks.getNodiaAiConversation.mockRejectedValue(error);
    await act(() => result.current.detail.refetch());
    await waitFor(() => expect(result.current.detail.accessRejected).toBe(true));
    expect(result.current.detail.data).toBeUndefined();
    expect(result.current.messages.data?.pages).toEqual([]);
    expect(client.getQueryData(["nodia-ai", "9", 1, "detail", chatId])).toBeNull();
    for (const key of privateKeys) expect(client.getQueryData(key)).toBeUndefined();
    expect(client.getQueryData(["nodia-ai", "9", 1, "detail", otherId])).toHaveProperty("conversation.conversation_id", otherId);
    expect(client.getQueryData(["nodia-ai", "9", 1, "conversations", {}])).toHaveProperty("pages.0.items.0.conversation_id", otherId);
    expect(mocks.getNodiaAiConversation).toHaveBeenCalledTimes(2);
    expect(mocks.getNodiaAiMessages).toHaveBeenCalledTimes(1);
    expect(mocks.admitNodiaAiMessage).not.toHaveBeenCalled();
  });

  it("hides expired search results and every inspected chat on a rejected list", async () => {
    const page = {items: [conversation], next_cursor: null};
    mocks.getNodiaAiConversations.mockResolvedValueOnce(page).mockRejectedValueOnce(Object.assign(new Error("forbidden"), {isAxiosError: true, response: {status: 403}}));
    client.setQueryData(["nodia-ai", "9", 1, "detail", chatId], detail);
    client.setQueryData(["nodia-ai", "9", 1, "messages", chatId], {pages: [{conversation_id: chatId, items: [], next_cursor: null}], pageParams: [undefined]});
    const {result} = renderHook(() => useNodiaAiConversations({view: "all"}), {wrapper: Wrapper});
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(() => result.current.refetch());
    await waitFor(() => expect(result.current.accessRejected).toBe(true));
    expect(result.current.data).toBeUndefined();
    expect(client.getQueryData(["nodia-ai", "9", 1, "detail", chatId])).toBeNull();
    expect(client.getQueryData(["nodia-ai", "9", 1, "messages", chatId])).toEqual({pages: [], pageParams: []});
    expect(mocks.getNodiaAiConversations).toHaveBeenCalledTimes(2);
  });

  it("removes cached detail after the messages endpoint denies access while preserving other sessions", async () => {
    client.setQueryData(["nodia-ai", "9", 1, "detail", chatId], detail);
    client.setQueryData(["nodia-ai", "10", 2, "detail", chatId], detail);
    mocks.getNodiaAiMessages.mockRejectedValue(Object.assign(new Error("expired"), {isAxiosError: true, response: {status: 410}}));
    const {result} = renderHook(() => useNodiaAiMessages(chatId), {wrapper: Wrapper});
    await waitFor(() => expect(result.current.accessRejected).toBe(true));
    expect(result.current.data).toBeUndefined();
    expect(client.getQueryData(["nodia-ai", "9", 1, "detail", chatId])).toBeNull();
    expect(client.getQueryData(["nodia-ai", "10", 2, "detail", chatId])).toEqual(detail);
    expect(mocks.getNodiaAiConversation).not.toHaveBeenCalled();
  });

  it("cancels a prior in-flight detail so a late success cannot restore a denied chat", async () => {
    mocks.getNodiaAiConversation.mockResolvedValueOnce(detail);
    mocks.getNodiaAiMessages.mockResolvedValueOnce({conversation_id: chatId, items: [], next_cursor: null});
    const {result} = renderHook(() => ({detail: useNodiaAiConversation(chatId), messages: useNodiaAiMessages(chatId)}), {wrapper: Wrapper});
    await waitFor(() => expect(result.current.detail.isSuccess && result.current.messages.isSuccess).toBe(true));
    let resolve: (value: typeof detail) => void = () => {};
    mocks.getNodiaAiConversation.mockReturnValue(new Promise<typeof detail>(done => {resolve = done;}));
    act(() => {void result.current.detail.refetch();});
    await waitFor(() => expect(mocks.getNodiaAiConversation).toHaveBeenCalledTimes(2));
    mocks.getNodiaAiMessages.mockRejectedValue(Object.assign(new Error("denied"), {isAxiosError: true, response: {status: 403}}));
    await act(() => result.current.messages.refetch());
    await waitFor(() => expect(result.current.messages.accessRejected).toBe(true));
    await act(async () => {resolve(detail); await Promise.resolve();});
    expect(result.current.messages.accessRejected).toBe(true);
    expect(result.current.detail.data).toBeUndefined();
    expect(client.getQueryData(["nodia-ai", "9", 1, "detail", chatId])).toBeNull();
    expect(mocks.getNodiaAiConversation).toHaveBeenCalledTimes(2);
  });

  it("does not re-read the final seal when active polling stops because the chat was denied", async () => {
    mocks.getNodiaAiMessages.mockResolvedValueOnce({conversation_id: chatId, items: [], next_cursor: null});
    const {result, rerender} = renderHook(({polling}) => useNodiaAiMessages(chatId, polling), {initialProps: {polling: true}, wrapper: Wrapper});
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    mocks.getNodiaAiMessages.mockRejectedValue(Object.assign(new Error("expired"), {isAxiosError: true, response: {status: 410}}));
    await act(() => result.current.refetch());
    await waitFor(() => expect(result.current.accessRejected).toBe(true));
    rerender({polling: false});
    await act(async () => {await Promise.resolve();});
    expect(mocks.getNodiaAiMessages).toHaveBeenCalledTimes(2);
    expect(mocks.admitNodiaAiMessage).not.toHaveBeenCalled();
  });

  it("preserves cached detail after a transient outage and never classifies cancellations as denial", async () => {
    const outage = Object.assign(new Error("offline"), {isAxiosError: true, response: {status: 503}});
    mocks.getNodiaAiConversation.mockResolvedValueOnce(detail).mockRejectedValueOnce(outage);
    const {result} = renderHook(() => useNodiaAiConversation(chatId), {wrapper: Wrapper});
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(() => result.current.refetch());
    await waitFor(() => {
      expect(result.current.error).toBe(outage);
      expect(result.current.isError).toBe(true);
      expect(result.current.isFetching).toBe(false);
    });
    expect(result.current.data).toEqual(detail);
    expect(result.current.draftAuthorized).toBe(true);
    expect(result.current.accessRejected).toBe(false);
    expect(isNodiaAiAccessDenied(Object.assign(new Error("cancelled"), {isAxiosError: true, code: "ERR_CANCELED"}))).toBe(false);
  });

  it("does not download the model catalog until configuration is requested", async () => {
    mocks.getNodiaAiCatalog.mockResolvedValue({items: [], next_cursor: null});
    const {result, rerender} = renderHook(({active}) => useNodiaAiCatalog(active), {initialProps: {active: false}, wrapper: Wrapper});
    expect(mocks.getNodiaAiCatalog).not.toHaveBeenCalled();
    expect(result.current.isFetching).toBe(false);
    rerender({active: true});
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.getNodiaAiCatalog).toHaveBeenCalledTimes(1);
  });

  it("reads the final seal after active polling stops without resending the user message", async () => {
    mocks.getNodiaAiMessages.mockResolvedValue({conversation_id: chatId, items: [], next_cursor: null});
    const {result, rerender} = renderHook(({polling}) => useNodiaAiMessages(chatId, polling), {initialProps: {polling: true}, wrapper: Wrapper});
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.getNodiaAiMessages).toHaveBeenCalledTimes(1);
    rerender({polling: false});
    await waitFor(() => expect(mocks.getNodiaAiMessages).toHaveBeenCalledTimes(2));
    expect(mocks.admitNodiaAiMessage).not.toHaveBeenCalled();
  });

  it("rechecks exact availability once after work finishes without replaying a message", async () => {
    const unavailable = { selection, available: false, reason: "nodia_ai:runtime_busy", observed_at: null, supports_mcp: false, routing_target: null };
    mocks.getNodiaAiEligibility.mockResolvedValueOnce(unavailable).mockResolvedValue({ ...unavailable, available: true, reason: null });
    const { result, rerender } = renderHook(({ active }) => useNodiaAiEligibility(selection, { conversationId: chatId, active }),
      { initialProps: { active: true }, wrapper: Wrapper });
    await waitFor(() => expect(result.current.data?.available).toBe(false));
    rerender({ active: true });
    expect(mocks.getNodiaAiEligibility).toHaveBeenCalledTimes(1);
    rerender({ active: false });
    await waitFor(() => expect(result.current.data?.available).toBe(true));
    rerender({ active: false });
    expect(mocks.getNodiaAiEligibility).toHaveBeenCalledTimes(2);
    expect(mocks.getNodiaAiEligibility.mock.calls.every(call => call[0] === selection)).toBe(true);
    expect(mocks.admitNodiaAiMessage).not.toHaveBeenCalled();
  });

  it("does not loop when the terminal availability recheck fails", async () => {
    mocks.getNodiaAiEligibility.mockResolvedValueOnce({ selection, available: true }).mockRejectedValue(new Error("offline"));
    const { result, rerender } = renderHook(({ active }) => useNodiaAiEligibility(selection, { conversationId: chatId, active }),
      { initialProps: { active: true }, wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    rerender({ active: false });
    await waitFor(() => expect(result.current.isError).toBe(true));
    rerender({ active: false });
    expect(mocks.getNodiaAiEligibility).toHaveBeenCalledTimes(2);
    expect(mocks.admitNodiaAiMessage).not.toHaveBeenCalled();
  });

  it("recovers when native acknowledgement arrives six seconds after SQL completion, using only bounded reads", async () => {
    const busy = { selection, available: false, reason: "nodia_ai:runtime_busy" };
    mocks.getNodiaAiEligibility.mockResolvedValueOnce({ ...busy, available: true, reason: null })
      .mockResolvedValueOnce(busy).mockResolvedValueOnce(busy).mockResolvedValue({ ...busy, available: true, reason: null });
    const { result, rerender } = renderHook(({ active }) => useNodiaAiEligibility(selection, { conversationId: chatId, active }),
      { initialProps: { active: true }, wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    vi.useFakeTimers();
    await act(async () => { rerender({ active: false }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(result.current.data?.available).toBe(false);
    expect(mocks.getNodiaAiEligibility).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(1001); });
    expect(result.current.data?.available).toBe(false);
    expect(mocks.getNodiaAiEligibility).toHaveBeenCalledTimes(3);
    await act(async () => { await vi.advanceTimersByTimeAsync(5001); });
    expect(result.current.data?.available).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
    expect(mocks.getNodiaAiEligibility).toHaveBeenCalledTimes(4);
    expect(mocks.admitNodiaAiMessage).not.toHaveBeenCalled();
    expect(mocks.setNodiaAiSelection).not.toHaveBeenCalled();
  });

  it("stops checking a persistently busy terminal profile after three additional GETs over twenty-one seconds", async () => {
    mocks.getNodiaAiEligibility.mockResolvedValue({ selection, available: false, reason: "nodia_ai:runtime_busy" });
    const { result, rerender } = renderHook(({ active }) => useNodiaAiEligibility(selection, { conversationId: chatId, active }),
      { initialProps: { active: true }, wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    vi.useFakeTimers();
    await act(async () => { rerender({ active: false }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    for (const delay of [1001, 5001, 15001]) await act(async () => { await vi.advanceTimersByTimeAsync(delay); });
    expect(mocks.getNodiaAiEligibility).toHaveBeenCalledTimes(5);
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(mocks.getNodiaAiEligibility).toHaveBeenCalledTimes(5);
    expect(result.current.data?.available).toBe(false);
    expect(mocks.admitNodiaAiMessage).not.toHaveBeenCalled();
  });

  it.each(["session_required", "adapter_unavailable", "model_unavailable"])("does not recheck terminal %s observations", async reason => {
    mocks.getNodiaAiEligibility.mockResolvedValue({ selection, available: false, reason: `nodia_ai:${reason}` });
    const { result, rerender } = renderHook(({ active }) => useNodiaAiEligibility(selection, { conversationId: chatId, active }),
      { initialProps: { active: true }, wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    vi.useFakeTimers();
    await act(async () => { rerender({ active: false }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(mocks.getNodiaAiEligibility).toHaveBeenCalledTimes(2);
  });

  it("does not retry an HTTP failure reached during native acknowledgement recovery", async () => {
    mocks.getNodiaAiEligibility.mockResolvedValueOnce({ selection, available: true, reason: null })
      .mockResolvedValueOnce({ selection, available: false, reason: "nodia_ai:runtime_busy" })
      .mockRejectedValue(new Error("synthetic outage"));
    const { result, rerender } = renderHook(({ active }) => useNodiaAiEligibility(selection, { conversationId: chatId, active }),
      { initialProps: { active: true }, wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    vi.useFakeTimers();
    await act(async () => { rerender({ active: false }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1001); });
    expect(result.current.isError).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(mocks.getNodiaAiEligibility).toHaveBeenCalledTimes(3);
  });

  it.each(["chat", "selection", "account", "logout", "unmount", "new_turn"] as const)("cancels scheduled completion reads on %s changes", async change => {
    mocks.getNodiaAiEligibility.mockImplementation(async selected => ({ selection: selected, available: false, reason: "nodia_ai:runtime_busy" }));
    const initial = { selected: selection, id: chatId, active: true };
    const { result, rerender, unmount } = renderHook(({ selected, id, active }) => useNodiaAiEligibility(selected, { conversationId: id, active }),
      { initialProps: initial, wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    vi.useFakeTimers();
    await act(async () => { rerender({ ...initial, active: false }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(mocks.getNodiaAiEligibility).toHaveBeenCalledTimes(2);
    await act(async () => {
      if (change === "unmount") unmount();
      else if (change === "account") authenticate("10", 2);
      else if (change === "logout") useAuthStore.setState({ token: null, user: null, sessionStatus: "anonymous" });
      else rerender({ ...initial, active: change === "new_turn", id: change === "chat" ? messageId : chatId,
        selected: change === "selection" ? { ...selection, model_id: "synthetic-other-model" } : selection });
      await vi.advanceTimersByTimeAsync(1);
    });
    const callsAfterChange = mocks.getNodiaAiEligibility.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(mocks.getNodiaAiEligibility).toHaveBeenCalledTimes(callsAfterChange);
    expect(mocks.admitNodiaAiMessage).not.toHaveBeenCalled();
  });

  it("waits for an initial in-flight observation before the single completion read", async () => {
    const unavailable = { selection, available: false, reason: "nodia_ai:runtime_busy" };
    let finish: (value: typeof unavailable) => void = () => {};
    mocks.getNodiaAiEligibility.mockReturnValueOnce(new Promise<typeof unavailable>(resolve => { finish = resolve; }))
      .mockResolvedValue({ ...unavailable, available: true, reason: null });
    const { result, rerender } = renderHook(({ active }) => useNodiaAiEligibility(selection, { conversationId: chatId, active }),
      { initialProps: { active: true }, wrapper: Wrapper });
    await waitFor(() => expect(result.current.isFetching).toBe(true));
    rerender({ active: false });
    expect(mocks.getNodiaAiEligibility).toHaveBeenCalledTimes(1);
    await act(async () => { finish(unavailable); });
    await waitFor(() => expect(result.current.data?.available).toBe(true));
    expect(mocks.getNodiaAiEligibility).toHaveBeenCalledTimes(2);
    expect(mocks.admitNodiaAiMessage).not.toHaveBeenCalled();
  });

  it("does not treat navigation to another idle chat as completion of the previous chat", async () => {
    mocks.getNodiaAiEligibility.mockResolvedValue({ selection, available: false });
    const { result, rerender } = renderHook(({ id, active }) => useNodiaAiEligibility(selection, { conversationId: id, active }),
      { initialProps: { id: chatId, active: true }, wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    rerender({ id: messageId, active: false });
    expect(mocks.getNodiaAiEligibility).toHaveBeenCalledTimes(1);
    expect(mocks.admitNodiaAiMessage).not.toHaveBeenCalled();
  });

  it("does not add a completion read across account or selection changes", async () => {
    mocks.getNodiaAiEligibility.mockImplementation(async (selected) => ({ selection: selected, available: false }));
    const { result, rerender } = renderHook(({ selected, active }) => useNodiaAiEligibility(selected, { conversationId: chatId, active }),
      { initialProps: { selected: selection, active: true }, wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const changed = { ...selection, model_id: "synthetic-other-model" };
    rerender({ selected: changed, active: false });
    await waitFor(() => expect(result.current.data?.selection).toEqual(changed));
    expect(mocks.getNodiaAiEligibility).toHaveBeenCalledTimes(2);
    rerender({ selected: changed, active: true });
    act(() => {
      authenticate("10", 2);
      rerender({ selected: changed, active: false });
    });
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(mocks.getNodiaAiEligibility).toHaveBeenCalledTimes(3);
    expect(mocks.admitNodiaAiMessage).not.toHaveBeenCalled();
  });

  it("reconstructs an unknown turn by GET and never automatically replays its inference", async () => {
    mocks.getNodiaAiConversation.mockResolvedValue({...detail, current_run: {...run, state: "unknown"}});
    const first = renderHook(() => useNodiaAiConversation(chatId), {wrapper: Wrapper});
    await waitFor(() => expect(first.result.current.data?.current_run?.state).toBe("unknown"));
    first.unmount();
    const second = renderHook(() => useNodiaAiConversation(chatId), {wrapper: Wrapper});
    await waitFor(() => expect(second.result.current.isFetching).toBe(false));
    expect(second.result.current.data?.current_run?.state).toBe("unknown");
    expect(mocks.admitNodiaAiMessage).not.toHaveBeenCalled();
  });

  it("does not automatically retry an uncertain write and retains the caller's idempotency identity", async () => {
    const input = {client_message_id: messageId, expected_conversation_revision: 1, parts: [{kind: "text" as const, text: "Synthetic request"}]};
    mocks.admitNodiaAiMessage.mockRejectedValueOnce(new Error("timeout")).mockResolvedValue({message_id: messageId, conversation_revision: 2, run});
    const {result} = renderHook(() => useAdmitNodiaAiMessage(chatId), {wrapper: Wrapper});
    await act(async () => { await expect(result.current.mutateAsync(input)).rejects.toThrow("timeout"); });
    expect(mocks.admitNodiaAiMessage).toHaveBeenCalledTimes(1);
    expect(mocks.error).toHaveBeenCalledTimes(1);
    await act(() => result.current.mutateAsync(input));
    expect(mocks.admitNodiaAiMessage.mock.calls[0]).toEqual(mocks.admitNodiaAiMessage.mock.calls[1]);
    expect(mocks.success).toHaveBeenCalledTimes(1);
  });

  it("rejects an old mutation closure after changing account before any transport call", async () => {
    const {result} = renderHook(() => useCreateNodiaAiConversation(), {wrapper: Wrapper});
    const oldMutation = result.current.mutateAsync;
    // A delayed handler cannot write with another account after rerender either.
    await act(async () => {
      authenticate("10", 2);
      await expect(oldMutation({client_request_id: messageId})).rejects.toThrow("nodia_ai:session_changed");
    });
    expect(mocks.createNodiaAiConversation).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("binds a captured mutation and its invalidation/callbacks to the original chat after rerender", async () => {
    const invalidate = vi.spyOn(client, "invalidateQueries");
    mocks.setNodiaAiRouting.mockResolvedValue(conversation);
    const {result, rerender} = renderHook(({id}) => useSetNodiaAiRouting(id), {initialProps: {id: chatId}, wrapper: Wrapper});
    const applyA = result.current.mutateAsync;
    const input = {expected_conversation_revision: 1, expected_routing_revision: 1, enabled: false, target: null};
    const onSuccess = vi.fn();
    rerender({id: messageId});
    await act(() => applyA(input, {onSuccess}));
    expect(mocks.setNodiaAiRouting).toHaveBeenCalledExactlyOnceWith(chatId, input);
    expect(invalidate).toHaveBeenCalledWith({queryKey: ["nodia-ai", "9", 1, "detail", chatId]});
    expect(invalidate).not.toHaveBeenCalledWith({queryKey: ["nodia-ai", "9", 1, "detail", messageId]});
    expect(onSuccess).toHaveBeenCalledWith(conversation, input, undefined, expect.any(Object));
  });

  it("updates only the original chat metadata and preserves run receipts after navigation", async () => {
    const updated = {...conversation, revision: conversation.revision + 1, title: "Renamed synthetic chat", is_pinned: true};
    client.setQueryData(["nodia-ai", "9", 1, "detail", chatId], {...detail, current_run: run});
    mocks.updateNodiaAiConversation.mockResolvedValue(updated);
    const {result, rerender} = renderHook(({id}) => useUpdateNodiaAiConversation(id), {initialProps: {id: chatId}, wrapper: Wrapper});
    const captured = result.current.mutateAsync;
    const input = {expected_conversation_revision: conversation.revision, title: updated.title, is_pinned: true};
    rerender({id: messageId});
    await act(() => captured(input));
    expect(mocks.updateNodiaAiConversation).toHaveBeenCalledExactlyOnceWith(chatId, input);
    expect(client.getQueryData(["nodia-ai", "9", 1, "detail", chatId])).toEqual({...detail, conversation: updated, current_run: run});
    expect(client.getQueryData(["nodia-ai", "9", 1, "detail", messageId])).toBeUndefined();
    expect(mocks.success).toHaveBeenCalledTimes(1);
  });

  it.each(["conversation", "run"])("does not replace a newer cached %s with an older admission receipt", async (newer) => {
    const saved = {...detail, conversation: {...conversation, revision: newer === "conversation" ? 3 : 2}, current_run: {...run, state: "completed" as const, revision: 4}};
    client.setQueryData(["nodia-ai", "9", 1, "detail", chatId], saved);
    mocks.admitNodiaAiMessage.mockResolvedValue({message_id: messageId, conversation_revision: 2, run});
    const {result} = renderHook(() => useAdmitNodiaAiMessage(chatId), {wrapper: Wrapper});
    await act(() => result.current.mutateAsync({client_message_id: messageId, expected_conversation_revision: 1, parts: [{kind: "text", text: "Same original request"}]}));
    expect(client.getQueryData(["nodia-ai", "9", 1, "detail", chatId])).toEqual(saved);
  });
});
