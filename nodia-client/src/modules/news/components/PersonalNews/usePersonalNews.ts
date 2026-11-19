import { useEffect, useRef, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { isCancel } from "axios";
import { sileo } from "sileo";
import useAuthStore, { hasActiveSession } from "../../../../store/authStore";
import i18n from "../../../../translate";
import type { PersonalArticle, PersonalConnection, PersonalProvider, PersonalRefreshStatus } from "./types";
import {
  connectPersonalSource, currentPersonalNewsActor, disconnectPersonalSource,
  getPersonalArticles, getPersonalConnections, personalNewsErrorKey, PersonalNewsError,
  refreshPersonalSource, testPersonalSource,
} from "./services";

const scopeKey = (actor: string) => ["news-personal", actor] as const;
const connectionsKey = (actor: string) => [...scopeKey(actor), "connections"] as const;
const articlesKey = (actor: string) => [...scopeKey(actor), "articles"] as const;

type Operation = "connect" | "test" | "refresh" | "disconnect";
type Result = { ok: true } | { ok: false; fieldError?: string; message?: string };
type OperationResult = {
  connection?: PersonalConnection;
  refreshStatus?: PersonalRefreshStatus;
};
type ActionState = { provider: PersonalProvider; operation: Operation };

export function usePersonalNews(actor: string, preferredProvider?: PersonalProvider) {
  const client = useQueryClient();
  const active = useAuthStore(hasActiveSession);
  const [action, setAction] = useState<ActionState | null>(null);
  const pending = useRef<AbortController | null>(null);
  const connections = useQuery({
    queryKey: connectionsKey(actor),
    queryFn: ({ signal }) => getPersonalConnections(actor, signal),
    enabled: active,
    gcTime: 0,
    retry: false,
    meta: { errorNotification: "handled-locally" },
  });
  const available = (connections.data?.connections ?? []).filter(({ state }) => state === "connected");
  const readingProvider = available.find(({ provider }) => provider === preferredProvider)?.provider ??
    available.find(({ provider }) => provider === "dev-community")?.provider ??
    available[0]?.provider;
  const articles = useQuery({
    queryKey: [...articlesKey(actor), readingProvider ?? "unselected"],
    queryFn: ({ signal }) => getPersonalArticles(actor, readingProvider, signal),
    enabled: active && readingProvider !== undefined,
    gcTime: 0,
    retry: false,
    placeholderData: readingProvider ? keepPreviousData : undefined,
    meta: { errorNotification: "handled-locally" },
  });

  useEffect(() => {
    const unsubscribe = useAuthStore.subscribe((state) => {
      if (currentPersonalNewsActor(state) === actor) return;
      pending.current?.abort();
      client.removeQueries({ queryKey: scopeKey(actor) });
    });
    return () => {
      unsubscribe();
      pending.current?.abort();
      pending.current = null;
    };
  }, [actor, client]);

  useEffect(() => {
    if (currentPersonalNewsActor() !== actor) return;
    const error = connections.error ?? articles.error;
    if (error instanceof PersonalNewsError) {
      sileo.error({
        title: i18n.t("news:personal_load_failed"),
        description: i18n.t(personalNewsErrorKey(error.code)),
      });
    }
  }, [actor, articles.error, connections.error]);

  function setConnection(selected: PersonalProvider, next?: PersonalConnection) {
    client.setQueryData<{ connections: PersonalConnection[] }>(connectionsKey(actor), (current) =>
      current && {
        connections: current.connections.map((item) => item.provider !== selected ? item : next ?? {
          provider: selected,
          state: "disconnected",
          account_name: null,
          key_hint: null,
          last_tested_at: null,
          last_test_error_code: null,
          last_refresh_attempt_at: null,
          last_refresh_success_at: null,
          last_refresh_error_code: null,
          next_refresh_at: null,
          retry_source: null,
          snapshot_status: null,
        }),
      },
    );
  }

  function clearArticles(selected: PersonalProvider) {
    client.setQueriesData<{ items: PersonalArticle[] }>({ queryKey: articlesKey(actor) }, (current) =>
      current && { items: current.items.filter((item) => item.provider !== selected) },
    );
  }

  function reconcile() {
    if (currentPersonalNewsActor() !== actor) return;
    void client.invalidateQueries({ queryKey: scopeKey(actor) });
  }

  async function run(
    selected: PersonalProvider,
    operation: Operation,
    execute: (signal: AbortSignal) => Promise<OperationResult>,
  ): Promise<Result> {
    if (pending.current || !hasActiveSession(useAuthStore.getState()) || currentPersonalNewsActor() !== actor)
      return { ok: false };
    const controller = new AbortController();
    pending.current = controller;
    setAction({ provider: selected, operation });
    const isCurrent = () => !controller.signal.aborted && currentPersonalNewsActor() === actor;
    try {
      const result = await execute(controller.signal);
      if (!isCurrent()) return { ok: false };
      await client.cancelQueries({ queryKey: scopeKey(actor) });
      if (!isCurrent()) return { ok: false };
      const clear = operation === "connect" || operation === "disconnect" ||
        result.connection?.state === "reconnect_required";
      if (clear) clearArticles(selected);
      setConnection(selected, result.connection);
      sileo.success({
        title: i18n.t(result.refreshStatus
          ? `news:personal_refresh_${result.refreshStatus}`
          : `news:personal_${operation}_success`),
      });
      return { ok: true };
    } catch (error) {
      if (!isCurrent() || isCancel(error)) return { ok: false };
      const code = error instanceof PersonalNewsError ? error.code : null;
      const changed = code === "operation_superseded" ||
        (code === "provider_credentials_invalid" && operation !== "connect");
      const uncertainWrite = (operation === "connect" || operation === "disconnect") &&
        (code === null || code === "unknown" || code === "invalid_response");
      if (changed || uncertainWrite) {
        await client.cancelQueries({ queryKey: scopeKey(actor) });
        if (!isCurrent()) return { ok: false };
        clearArticles(selected);
      }
      const message = i18n.t(personalNewsErrorKey(code, selected));
      sileo.error({ title: i18n.t("news:personal_action_failed"), description: message });
      return operation === "connect" && code === "provider_credentials_invalid"
        ? { ok: false, fieldError: message }
        : { ok: false, message };
    } finally {
      if (pending.current === controller) pending.current = null;
      if (isCurrent()) {
        setAction(null);
        reconcile();
      }
    }
  }

  return {
    active,
    action,
    articles,
    available,
    connections,
    readingProvider,
    connect: (selected: PersonalProvider, apiKey: string) => run(
      selected, "connect", (signal) => connectPersonalSource(actor, selected, apiKey, signal),
    ),
    test: (selected: PersonalProvider) => run(
      selected, "test", (signal) => testPersonalSource(actor, selected, signal),
    ),
    refresh: (selected: PersonalProvider) => run(
      selected, "refresh", (signal) => refreshPersonalSource(actor, selected, signal).then(
        ({ connection, status }) => ({ connection, refreshStatus: status }),
      ),
    ),
    disconnect: (selected: PersonalProvider) => run(selected, "disconnect", async (signal) => {
      await disconnectPersonalSource(actor, selected, signal);
      return {};
    }),
  };
}
