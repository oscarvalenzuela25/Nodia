import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useAuthStore from "../../../../store/authStore";
import {
  useAdmitNodiaAiMessage, useCreateNodiaAiConversation, useNodiaAiConversation,
  useNodiaAiCatalog, useNodiaAiConversations, useNodiaAiMessages, useSetNodiaAiRouting,
  useUpdateNodiaAiConversation, isNodiaAiAccessDenied,
} from "../../../../modules/nodiaAi/infrastructure/useServices";
import { chatId, conversation, detail, messageId, run } from "./fixtures";

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
  afterEach(() => { cleanup(); client.clear(); useAuthStore.setState({token: null, user: null, sessionStatus: "anonymous"}); });

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
    mocks.getNodiaAiConversation.mockResolvedValueOnce(detail).mockRejectedValueOnce(Object.assign(new Error("offline"), {isAxiosError: true, response: {status: 503}}));
    const {result} = renderHook(() => useNodiaAiConversation(chatId), {wrapper: Wrapper});
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(() => result.current.refetch());
    expect(result.current.data).toEqual(detail);
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
