import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  useIsFetching,
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { sileo } from "sileo";
import useAuthStore, { hasValidatedSession } from "../../../store/authStore";
import { notifyHttpError } from "../../../config/httpFeedback";
import i18n from "../../../translate";
import type {
  RentalAck,
  RentalCommand,
  RentalListResource,
  RentalOperation,
  RentalPreviewInput,
  RentalQuery,
} from "../types";
import {
  assertRentalAckMatches,
  executeRentalCommand,
  getRentalList,
  getRentalRead,
  getRentalRecord,
  previewRentalCancellation,
  recoverRentalOperation,
} from "./services";
import type { rentalReadSchemas } from "./services";
import {
  isRentalWriteUncertain,
  rentalIntentSessionValid,
  rentalPendingCount,
  rentalRequestKey,
  removeRentalIntent,
  setRentalIntent,
  subscribeRentalIntents,
} from "./intents";
import type { RentalIntent } from "./intents";

import { RentalAccessContext } from "./scope";

export const rentalKeys = {
  actor: (actorId?: string) => ["rental", actorId] as const,
  scope: (actorId?: string, propertyId?: string) =>
    ["rental", actorId, propertyId] as const,
  list: (
    actorId: string | undefined,
    propertyId: string | undefined,
    resource: RentalListResource,
    query: RentalQuery,
  ) => ["rental", actorId, propertyId, "list", resource, query] as const,
  detail: (
    actorId: string | undefined,
    propertyId: string | undefined,
    resource: RentalListResource,
    id?: string,
  ) =>
    [
      "rental",
      actorId,
      resource === "properties" ? id : propertyId,
      "detail",
      resource,
      id,
    ] as const,
  read: (
    actorId: string | undefined,
    propertyId: string | undefined,
    kind: string,
    query: RentalQuery,
  ) => ["rental", actorId, propertyId, "read", kind, query] as const,
};
function useActor() {
  const accessible = useContext(RentalAccessContext);
  const id = useAuthStore((state) => state.user?.id);
  const validated = useAuthStore(hasValidatedSession);
  const version = useAuthStore((state) => state.sessionVersion);
  return { id, version, enabled: Boolean(id && validated && accessible) };
}
async function verifyResourceAccess(
  client: QueryClient,
  actorId: string | undefined,
  propertyId: string | undefined,
  error: unknown,
) {
  if (
    !propertyId ||
    !isAxiosError(error) ||
    ![403, 404].includes(error.response?.status ?? 0) ||
    useAuthStore.getState().user?.id !== actorId
  )
    return;
  try {
    await getRentalRecord("properties", undefined, propertyId);
  } catch (cause) {
    if (
      isAxiosError(cause) &&
      cause.response?.status === 404 &&
      useAuthStore.getState().user?.id === actorId
    ) {
      await client.cancelQueries({
        predicate: (query) =>
          query.queryKey[0] === "rental" &&
          query.queryKey[1] === actorId &&
          query.queryKey[2] === propertyId &&
          query.queryKey[4] !== "properties",
      });
      client.removeQueries({
        predicate: (query) =>
          query.queryKey[0] === "rental" &&
          query.queryKey[1] === actorId &&
          query.queryKey[2] === propertyId &&
          query.queryKey[4] !== "properties",
      });
    }
  }
  if (useAuthStore.getState().user?.id === actorId)
    void client.invalidateQueries({
      queryKey: rentalKeys.detail(actorId, undefined, "properties", propertyId),
    });
}
export function useRentalList<R extends RentalListResource>(
  resource: R,
  propertyId: string | undefined,
  query: RentalQuery = {},
  enabled = true,
) {
  const actor = useActor();
  const client = useQueryClient();
  const verify = useCallback(
    (error: unknown) =>
      verifyResourceAccess(client, actor.id, propertyId, error),
    [client, actor.id, propertyId],
  );
  return useQuery({
    queryKey: rentalKeys.list(actor.id, propertyId, resource, query),
    queryFn: async ({ signal }) => {
      try {
        return await getRentalList(resource, propertyId, query, signal);
      } catch (error) {
        void verify(error);
        throw error;
      }
    },
    enabled:
      actor.enabled &&
      enabled &&
      (resource === "properties" || Boolean(propertyId)),
    retry: false,
    placeholderData: (previous, previousQuery) =>
      previousQuery &&
      previousQuery.queryKey[1] === actor.id &&
      previousQuery.queryKey[2] === propertyId &&
      previousQuery.queryKey[4] === resource
        ? previous
        : undefined,
  });
}
export function useRentalRecord<R extends RentalListResource>(
  resource: R,
  propertyId: string | undefined,
  id?: string,
  enabled = true,
) {
  const actor = useActor();
  const client = useQueryClient();
  const verify = useCallback(
    (error: unknown) =>
      verifyResourceAccess(client, actor.id, propertyId, error),
    [client, actor.id, propertyId],
  );
  return useQuery({
    queryKey: rentalKeys.detail(actor.id, propertyId, resource, id),
    queryFn: async ({ signal }) => {
      try {
        return await getRentalRecord(resource, propertyId, id!, signal);
      } catch (error) {
        if (resource !== "properties") void verify(error);
        throw error;
      }
    },
    enabled:
      actor.enabled &&
      enabled &&
      Boolean(id) &&
      (resource === "properties" || Boolean(propertyId)),
    retry: false,
  });
}
export function useRentalProperty(propertyId?: string, enabled = true) {
  return useRentalRecord("properties", undefined, propertyId, enabled);
}
function useRead<K extends keyof typeof rentalReadSchemas>(
  kind: K,
  propertyId: string | undefined,
  query: RentalQuery,
  enabled: boolean,
) {
  const actor = useActor();
  const client = useQueryClient();
  const verify = useCallback(
    (error: unknown) =>
      verifyResourceAccess(client, actor.id, propertyId, error),
    [client, actor.id, propertyId],
  );
  return useQuery({
    queryKey: rentalKeys.read(actor.id, propertyId, kind, query),
    queryFn: async ({ signal }) => {
      try {
        return await getRentalRead(kind, propertyId!, query, signal);
      } catch (error) {
        void verify(error);
        throw error;
      }
    },
    enabled: actor.enabled && Boolean(propertyId) && enabled,
    retry: false,
    placeholderData: (previous, previousQuery) =>
      previousQuery &&
      previousQuery.queryKey[1] === actor.id &&
      previousQuery.queryKey[2] === propertyId &&
      previousQuery.queryKey[4] === kind
        ? previous
        : undefined,
  });
}
export const useRentalCalendar = (
  propertyId: string | undefined,
  query: RentalQuery,
  enabled = true,
) => useRead("calendar", propertyId, query, enabled);
export const useRentalAvailability = (
  propertyId: string | undefined,
  query: RentalQuery,
  enabled = true,
) => useRead("availability", propertyId, query, enabled);
export const useRentalOverview = (
  propertyId: string | undefined,
  query: RentalQuery,
  enabled = true,
) => useRead("overview", propertyId, query, enabled);
export function useRentalCancellationPreview(propertyId: string, id: string) {
  const actor = useActor();
  // POST read: explicit preview, no idempotency header, no mutation-success notification.
  const preview = useMutation({
    mutationKey: [...rentalKeys.scope(actor.id, propertyId), "preview", id],
    mutationFn: async (input: RentalPreviewInput) => {
      if (!actor.enabled) throw new Error("rental:not_found");
      return previewRentalCancellation(propertyId, id, input);
    },
    retry: false,
    onError: notifyHttpError,
  });
  return {
    execute: preview.mutateAsync,
    isPending: preview.isPending,
    error: preview.error,
  };
}
export function useRentalBusy(propertyId?: string): boolean {
  const actor = useActor();
  const pending = useSyncExternalStore(
    subscribeRentalIntents,
    () => rentalPendingCount(actor.id, propertyId),
    () => 0,
  );
  const fetching = useIsFetching({
    predicate: (query) =>
      query.queryKey[0] === "rental" &&
      query.queryKey[1] === actor.id &&
      (propertyId === undefined || query.queryKey[2] === propertyId),
  });
  const mutating = useIsMutating({
    predicate: (mutation) =>
      mutation.options.mutationKey?.[0] === "rental" &&
      mutation.options.mutationKey[1] === actor.id &&
      (propertyId === undefined ||
        mutation.options.mutationKey[2] === propertyId),
  });
  const accessible = useContext(RentalAccessContext);
  return !accessible || pending > 0 || fetching > 0 || mutating > 0;
}
export function useRentalPendingCount(propertyId?: string): number {
  const actor = useActor();
  return useSyncExternalStore(
    subscribeRentalIntents,
    () => rentalPendingCount(actor.id, propertyId),
    () => 0,
  );
}
const effects: Record<string, string[]> = {
  property: ["properties", "availability", "calendar", "turnovers", "overview"],
  collaborator: ["collaborators", "collaborator-candidates", "properties"],
  policy: ["cancellation-policies", "properties", "availability"],
  reservation: [
    "reservations",
    "turnovers",
    "calendar",
    "availability",
    "overview",
    "payments",
    "preview",
  ],
  payment: ["payments", "reservations", "overview", "preview"],
  expense: ["expenses", "overview"],
  block: [
    "blocks",
    "reservations",
    "turnovers",
    "calendar",
    "availability",
    "overview",
  ],
  turnover: [
    "turnovers",
    "reservations",
    "calendar",
    "availability",
    "overview",
  ],
};
export async function invalidateRentalMutation(
  client: QueryClient,
  actorId: string,
  ack: RentalAck,
) {
  const affected = new Set([...effects[ack.resource_type], "audit-events"]);
  await client.invalidateQueries({
    predicate: (query) =>
      query.queryKey[0] === "rental" &&
      query.queryKey[1] === actorId &&
      ((query.queryKey[2] === ack.property_id &&
        affected.has(String(query.queryKey[4] ?? query.queryKey[3]))) ||
        (affected.has("properties") &&
          query.queryKey[4] === "properties" &&
          query.queryKey[2] === undefined)),
  });
}
export function useRentalMutation(propertyId?: string) {
  const actor = useActor();
  const client = useQueryClient();
  const [intent, setIntent] = useState<RentalIntent>();
  const [error, setError] = useState<unknown>();
  const current = useRef<RentalIntent | undefined>(undefined);
  const transport = useMutation({
    mutationKey: [...rentalKeys.scope(actor.id, propertyId), "mutation"],
    mutationFn: (value: RentalIntent) =>
      executeRentalCommand(value.propertyId, value.command, value.key),
    retry: false,
  });
  const actorKey = `${actor.id}:${actor.version}:${propertyId}`;
  const identity = useRef(actorKey);
  useEffect(() => {
    identity.current = actorKey;
    return () => {
      current.current = undefined;
      identity.current = "unmounted";
    };
  }, [actorKey]);
  const finish = useCallback(
    async (value: RentalIntent, ack: RentalAck) => {
      if (
        !rentalIntentSessionValid(value) ||
        identity.current !==
          `${value.actorId}:${value.sessionVersion}:${value.propertyId}`
      )
        return undefined;
      removeRentalIntent(value.key);
      current.current = undefined;
      setIntent(undefined);
      setError(undefined);
      sileo.success({ title: i18n.t("rental:saved") });
      // Confirmed write remains successful even if refetch reports its own error.
      void invalidateRentalMutation(client, value.actorId, ack);
      return ack;
    },
    [client],
  );
  const run = async (
    value: RentalIntent,
    recovery = false,
  ): Promise<RentalAck | undefined> => {
    if (
      !rentalIntentSessionValid(value) ||
      (value.phase === "sending" && transport.isPending)
    )
      return undefined;
    const active = {
      ...value,
      phase: recovery ? ("recovering" as const) : ("sending" as const),
    };
    current.current = active;
    setIntent(active);
    setRentalIntent(active);
    setError(undefined);
    try {
      const ack =
        recovery && active.propertyId
          ? (await recoverRentalOperation(active.propertyId, active.key)).body
          : await transport.mutateAsync(active);
      assertRentalAckMatches(ack, active.propertyId, active.command);
      return await finish(active, ack);
    } catch (cause) {
      if (
        !rentalIntentSessionValid(active) ||
        identity.current !==
          `${active.actorId}:${active.sessionVersion}:${active.propertyId}`
      )
        return undefined;
      setError(cause);
      notifyHttpError(cause);
      void verifyResourceAccess(
        client,
        active.actorId,
        active.propertyId,
        cause,
      );
      if (
        recovery ||
        value.phase === "uncertain" ||
        isRentalWriteUncertain(cause)
      ) {
        const uncertain = { ...active, phase: "uncertain" as const };
        current.current = uncertain;
        setIntent(uncertain);
        setRentalIntent(uncertain);
      } else {
        removeRentalIntent(active.key);
        current.current = undefined;
        setIntent(undefined);
      }
      return undefined;
    }
  };
  const execute = async (
    command: RentalCommand,
  ): Promise<RentalAck | undefined> => {
    if (!actor.enabled || !actor.id || current.current) return undefined;
    const value: RentalIntent = {
      key: rentalRequestKey(),
      actorId: actor.id,
      sessionVersion: actor.version,
      propertyId,
      command: structuredClone(command),
      phase: "sending",
    };
    return run(value);
  };
  const retry = () =>
    current.current?.phase === "uncertain"
      ? run(current.current)
      : Promise.resolve(undefined);
  const recover = () =>
    current.current?.phase === "uncertain"
      ? run(current.current, Boolean(current.current.propertyId))
      : Promise.resolve(undefined);
  const activeIntent =
    intent &&
    intent.actorId === actor.id &&
    intent.sessionVersion === actor.version &&
    intent.propertyId === propertyId
      ? intent
      : undefined;
  return {
    execute,
    retry,
    recover,
    intent: activeIntent,
    error,
    isPending:
      transport.isPending ||
      activeIntent?.phase === "recovering" ||
      activeIntent?.phase === "sending",
    isUncertain: activeIntent?.phase === "uncertain",
  };
}
export type RentalMutation = ReturnType<typeof useRentalMutation>;
export type { RentalOperation };
