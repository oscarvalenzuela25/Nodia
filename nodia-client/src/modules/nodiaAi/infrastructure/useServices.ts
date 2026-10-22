import { hashKey, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InfiniteData, MutateOptions, QueryClient, QueryKey } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { isAxiosError } from "axios";
import { sileo } from "sileo";
import useAuth from "../../../hooks/useAuth";
import useAuthStore, { hasActiveSession } from "../../../store/authStore";
import { notifyHttpError } from "../../../config/httpFeedback";
import i18n from "../../../translate";
import {
  admitNodiaAiMessage, createNodiaAiConversation, getNodiaAiCatalog, getNodiaAiConversation,
  getNodiaAiConversations, getNodiaAiEligibility, getNodiaAiMessages, setNodiaAiRouting, setNodiaAiSelection, updateNodiaAiConversation,
} from "./services";
import type {
  NodiaAiAdmitInput, NodiaAiCreateInput, NodiaAiListParams,
  NodiaAiDetail, NodiaAiRoutingInput, NodiaAiRunState, NodiaAiSelection, NodiaAiSelectionInput, NodiaAiExecutionStatus,
  NodiaAiConversation, NodiaAiConversationUpdateInput, NodiaAiPage,
} from "./types";

export const isNodiaAiRunActive = (state: NodiaAiRunState | undefined): boolean =>
  state === "queued" || state === "running" || state === "cancel_requested";
export const isNodiaAiExecutionActive = (state: NodiaAiExecutionStatus["state"] | undefined): boolean =>
  state === "queued" || state === "running" || state === "waiting_for_user" || state === "cancel_requested" || state === "unknown";

type Scope = readonly [string | null, number];
export const nodiaAiKeys = {
  all: (scope: Scope) => ["nodia-ai", ...scope] as const,
  lists: (scope: Scope) => [...nodiaAiKeys.all(scope), "conversations"] as const,
  list: (scope: Scope, params: NodiaAiListParams) => [...nodiaAiKeys.lists(scope), params] as const,
  detail: (scope: Scope, id: string | null) => [...nodiaAiKeys.all(scope), "detail", id] as const,
  messages: (scope: Scope, id: string | null) => [...nodiaAiKeys.all(scope), "messages", id] as const,
  catalog: (scope: Scope) => [...nodiaAiKeys.all(scope), "connections"] as const,
  eligibility: (scope: Scope, selection: NodiaAiSelection | null) => [...nodiaAiKeys.all(scope), "eligibility", selection] as const,
};
const useScope = () => {
  const { user, sessionVersion, isSessionActive } = useAuth();
  return { scope: [user?.id ?? null, sessionVersion] as const, enabled: isSessionActive && Boolean(user?.id) };
};

export const isNodiaAiAccessDenied = (error: unknown): boolean =>
  isAxiosError(error) && [401, 403, 404, 410].includes(error.response?.status ?? 0);

/** Remove rejected content without requesting or replaying anything. In-flight
 * readers are cancelled first so an older response cannot restore that content. */
async function discardRejectedContent(client: QueryClient, scope: Scope, source: QueryKey, conversationId?: string) {
  const sourceHash = hashKey(source);
  const chatKinds = new Set(["detail", "messages", "events", "run", "attachment", "proposal", "proposal-review"]);
  const unboundKinds = new Set(["observation", "execution"]);
  const matching = (key: QueryKey) => {
    const kind = String(key[3]);
    return (chatKinds.has(kind) && (conversationId === undefined || key[4] === conversationId)) || unboundKinds.has(kind);
  };
  await client.cancelQueries({ queryKey: nodiaAiKeys.all(scope), predicate: query => query.queryHash !== sourceHash
    && (matching(query.queryKey) || query.queryKey[3] === "conversations") });
  client.setQueriesData<InfiniteData<NodiaAiPage<NodiaAiConversation>>>({ queryKey: nodiaAiKeys.lists(scope) }, cached => cached ? {
    ...cached, pages: cached.pages.map(page => ({ ...page, items: conversationId === undefined ? [] : page.items.filter(chat => chat.conversation_id !== conversationId),
      ...(conversationId === undefined ? { next_cursor: null } : {}) })),
  } : cached);
  for (const query of client.getQueryCache().findAll({ queryKey: nodiaAiKeys.all(scope), predicate: item => matching(item.queryKey) })) {
    if (query.queryKey[3] === "detail") client.setQueryData(query.queryKey, null);
    else if (query.queryKey[3] === "messages") client.setQueryData(query.queryKey, { pages: [], pageParams: [] });
    else client.removeQueries({ queryKey: query.queryKey, exact: true });
  }
}

export function useNodiaAiConversations(params: NodiaAiListParams = {}) {
  const { scope, enabled } = useScope();
  const query = useInfiniteQuery({
    queryKey: nodiaAiKeys.list(scope, params), initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal, queryKey, client }) => {
      try { return await getNodiaAiConversations({ ...params, ...(pageParam ? { cursor: pageParam } : {}) }, signal); }
      catch (error) {
        if (isNodiaAiAccessDenied(error)) await discardRejectedContent(client, scope, queryKey);
        throw error;
      }
    },
    getNextPageParam: (page) => page.next_cursor ?? undefined, enabled, retry: false,
  });
  const accessRejected = isNodiaAiAccessDenied(query.error);
  return { data: accessRejected ? undefined : query.data, accessRejected, error: query.error,
    isLoading: query.isLoading, isFetching: query.isFetching, isError: query.isError, isSuccess: query.isSuccess,
    hasNextPage: query.hasNextPage, isFetchingNextPage: query.isFetchingNextPage, fetchNextPage: query.fetchNextPage, refetch: query.refetch };
}
export function useNodiaAiCatalog(active = true) {
  const { scope, enabled } = useScope();
  return useInfiniteQuery({
    queryKey: nodiaAiKeys.catalog(scope), initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => getNodiaAiCatalog(pageParam, signal),
    getNextPageParam: (page) => page.next_cursor ?? undefined, enabled: enabled && active, retry: false,
  });
}
export function useNodiaAiConversation(id: string | null) {
  const { scope, enabled } = useScope();
  const query = useQuery<NodiaAiDetail | null>({
    queryKey: nodiaAiKeys.detail(scope, id), queryFn: async ({ signal, queryKey, client }) => {
      try { return await getNodiaAiConversation(id!, signal); }
      catch (error) {
        if (id !== null && isNodiaAiAccessDenied(error)) await discardRejectedContent(client, scope, queryKey, id);
        throw error;
      }
    },
    enabled: enabled && id !== null, retry: false,
    refetchInterval: (query) => !query.state.error && (isNodiaAiRunActive(query.state.data?.current_run?.state)
      || isNodiaAiExecutionActive(query.state.data?.active_execution?.state)) ? 2000 : false,
  });
  const accessRejected = isNodiaAiAccessDenied(query.error);
  return { data: accessRejected ? undefined : query.data ?? undefined, accessRejected, error: query.error,
    isLoading: query.isLoading, isFetching: query.isFetching, isError: query.isError, isSuccess: query.isSuccess, refetch: query.refetch };
}
export function useNodiaAiMessages(id: string | null, polling = false) {
  const { scope, enabled } = useScope();
  const client = useQueryClient();
  const previous = useRef({ id, polling });
  const [userId, sessionVersion] = scope;
  useEffect(() => {
    const before = previous.current;
    previous.current = { id, polling };
    // The final assistant seal can happen after the last history poll. Read it
    // once on transition; this never admits or replays a message.
    if (enabled && id !== null && before.id === id && before.polling && !polling
      && client.getQueryData(nodiaAiKeys.detail([userId, sessionVersion], id)) !== null
      && !isNodiaAiAccessDenied(client.getQueryState(nodiaAiKeys.messages([userId, sessionVersion], id))?.error))
      void client.invalidateQueries({ queryKey: nodiaAiKeys.messages([userId, sessionVersion], id) });
  }, [client, enabled, id, polling, userId, sessionVersion]);
  const query = useInfiniteQuery({
    queryKey: nodiaAiKeys.messages(scope, id), initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal, queryKey, client }) => {
      try { return await getNodiaAiMessages(id!, pageParam, signal); }
      catch (error) {
        if (id !== null && isNodiaAiAccessDenied(error)) await discardRejectedContent(client, scope, queryKey, id);
        throw error;
      }
    },
    getNextPageParam: (page) => page.next_cursor ?? undefined, enabled: enabled && id !== null, retry: false,
    refetchInterval: (query) => !query.state.error && polling ? 2000 : false,
  });
  const accessRejected = isNodiaAiAccessDenied(query.error);
  return { data: accessRejected ? undefined : query.data, accessRejected, error: query.error,
    isLoading: query.isLoading, isFetching: query.isFetching, isError: query.isError, isSuccess: query.isSuccess,
    hasNextPage: query.hasNextPage, isFetchingNextPage: query.isFetchingNextPage, fetchNextPage: query.fetchNextPage, refetch: query.refetch };
}
export function useNodiaAiEligibility(selection: NodiaAiSelection | null) {
  const { scope, enabled } = useScope();
  return useQuery({
    queryKey: nodiaAiKeys.eligibility(scope, selection),
    queryFn: ({ signal }) => getNodiaAiEligibility(selection!, signal),
    enabled: enabled && selection !== null, retry: false, staleTime: 0, gcTime: 0,
  });
}

function isCurrentScope(scope: Scope): boolean {
  const auth = useAuthStore.getState();
  return hasActiveSession(auth) && auth.user?.id === scope[0] && auth.sessionVersion === scope[1];
}
function requireScope(scope: Scope): void {
  if (!isCurrentScope(scope)) throw new Error("nodia_ai:session_changed");
}
function notifySuccess(key: string, scope: Scope) {
  if (isCurrentScope(scope)) sileo.success({ title: i18n.t(`nodiaAi:notifications.${key}`) });
}

interface BoundMutation<I> { conversationId: string | null; scope: Scope; input: I }
function useNodiaAiWrite<I, O>(
  id: string | null,
  execute: (id: string | null, input: I) => Promise<O>,
  successKey: string,
  invalidateMessages = false,
  onAccepted?: (data: O, variables: BoundMutation<I>) => void,
) {
  const { scope } = useScope();
  const client = useQueryClient();
  const mutation = useMutation<O, Error, BoundMutation<I>>({
    mutationFn: (variables) => {
      requireScope(variables.scope);
      return execute(variables.conversationId, variables.input);
    }, retry: false,
    onError: (error, variables) => { if (isCurrentScope(variables.scope)) notifyHttpError(error); },
    onSuccess: async (_data, variables) => {
      if (isCurrentScope(variables.scope)) onAccepted?.(_data, variables);
      notifySuccess(successKey, variables.scope);
      await Promise.all([
        client.invalidateQueries({ queryKey: nodiaAiKeys.lists(variables.scope) }),
        ...(variables.conversationId === null ? [] : [client.invalidateQueries({ queryKey: nodiaAiKeys.detail(variables.scope, variables.conversationId) })]),
        ...(invalidateMessages ? [client.invalidateQueries({ queryKey: nodiaAiKeys.messages(variables.scope, variables.conversationId) })] : []),
      ]);
    },
  });
  const mapOptions = (options?: MutateOptions<O, Error, I>): MutateOptions<O, Error, BoundMutation<I>> | undefined => options ? {
    onSuccess: (data, variables, context, mutationContext) => options.onSuccess?.(data, variables.input, context, mutationContext),
    onError: (error, variables, context, mutationContext) => options.onError?.(error, variables.input, context, mutationContext),
    onSettled: (data, error, variables, context, mutationContext) => options.onSettled?.(data, error, variables.input, context, mutationContext),
  } : undefined;
  // A previously captured operation must retain its chat and actor even when
  // TanStack updates this observer's options after browser navigation.
  return {
    ...mutation,
    variables: mutation.variables?.input,
    mutate: (input: I, options?: MutateOptions<O, Error, I>) => mutation.mutate({conversationId: id, scope, input}, mapOptions(options)),
    mutateAsync: (input: I, options?: MutateOptions<O, Error, I>) => mutation.mutateAsync({conversationId: id, scope, input}, mapOptions(options)),
  };
}
function requireConversation(id: string | null): string {
  if (id === null) throw new Error("nodia_ai:invalid_input");
  return id;
}
export function useCreateNodiaAiConversation() {
  return useNodiaAiWrite(null, (_id, input: NodiaAiCreateInput) => createNodiaAiConversation(input), "created");
}
export function useUpdateNodiaAiConversation(id: string | null) {
  const client = useQueryClient();
  return useNodiaAiWrite(id, (boundId, input: NodiaAiConversationUpdateInput) => updateNodiaAiConversation(requireConversation(boundId), input), "updated", false, (conversation, variables) => {
    client.setQueryData<NodiaAiDetail | null>(nodiaAiKeys.detail(variables.scope, variables.conversationId), cached =>
      cached && cached.conversation.conversation_id === conversation.conversation_id && cached.conversation.revision <= conversation.revision
        ? { ...cached, conversation } : cached);
  });
}
export function useAdmitNodiaAiMessage(id: string | null) {
  const client = useQueryClient();
  return useNodiaAiWrite(id, (boundId, input: NodiaAiAdmitInput) => admitNodiaAiMessage(requireConversation(boundId), input), "message_sent", true, (admission, variables) => {
    client.setQueryData<NodiaAiDetail>(nodiaAiKeys.detail(variables.scope, variables.conversationId), (cached) => {
      if (!cached || cached.conversation.conversation_id !== variables.conversationId || cached.conversation.revision > admission.conversation_revision)
        return cached;
      const latest = cached.current_run;
      if (latest && (Date.parse(latest.created_at) > Date.parse(admission.run.created_at)
        || (latest.run_id === admission.run.run_id && latest.revision > admission.run.revision)))
        return cached;
      // The durable 202 already proves these two values. Preserve that proof if
      // a following GET fails; no provider result or timestamp is fabricated.
      return {...cached, conversation: {...cached.conversation, revision: admission.conversation_revision}, current_run: admission.run};
    });
  });
}
export function useSetNodiaAiSelection(id: string | null) {
  return useNodiaAiWrite(id, (boundId, input: NodiaAiSelectionInput) => setNodiaAiSelection(requireConversation(boundId), input), "selection_saved");
}
export function useSetNodiaAiRouting(id: string | null) {
  return useNodiaAiWrite(id, (boundId, input: NodiaAiRoutingInput) => setNodiaAiRouting(requireConversation(boundId), input), "routing_saved");
}
