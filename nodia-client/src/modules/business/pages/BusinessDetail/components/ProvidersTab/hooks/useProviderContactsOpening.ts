import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from "react";
import { sileo } from "sileo";
import useAuth from "../../../../../../../hooks/useAuth";
import useAuthStore, { hasActiveSession } from "../../../../../../../store/authStore";
import i18n from "../../../../../../../translate";
import type { ProviderEntity } from "../../../../../infrastructure/types";
import type { ProviderContactsProps } from "../components/ProviderContacts/ProviderContacts";
import { loadProviderContacts, type ProviderContactsLoader } from "../loadProviderContacts";

type OpeningRequest = {
  scope: string;
  provider: ProviderEntity;
  failed: boolean;
  attempt: number;
  opener: HTMLElement | null;
};

const isCurrentSession = (actorId: string | undefined, sessionVersion: number) => {
  const auth = useAuthStore.getState();
  return Boolean(actorId && auth.user?.id === actorId && auth.sessionVersion === sessionVersion && hasActiveSession(auth));
};

/** Keep the list mounted until this exact context's requested contact editor is ready. */
export default function useProviderContactsOpening(
  businessId: string,
  onReady: (provider: ProviderEntity) => void,
  load: ProviderContactsLoader = loadProviderContacts,
) {
  const { user, sessionVersion, isSessionActive } = useAuth();
  const actorId = user?.id;
  const scope = JSON.stringify([actorId, sessionVersion, businessId]);
  const [Component, setComponent] = useState<ComponentType<ProviderContactsProps> | null>(null);
  const [request, setRequest] = useState<OpeningRequest | null>(null);
  const generation = useRef(0);
  const inFlight = useRef<string | null>(null);

  useEffect(() => () => {
    generation.current += 1;
    inFlight.current = null;
  }, [scope]);

  // The initiating button is disabled during download. Restore only after
  // React has committed the failure state and enabled the control again.
  useLayoutEffect(() => {
    if (request?.failed && request.scope === scope && request.attempt === generation.current
      && isCurrentSession(actorId, sessionVersion) && request.opener?.isConnected) {
      request.opener.focus();
    }
  }, [request, scope, actorId, sessionVersion]);

  const open = async (provider: ProviderEntity): Promise<void> => {
    if (!isSessionActive || !isCurrentSession(actorId, sessionVersion) || provider.business_id !== businessId || inFlight.current === scope) return;
    if (Component) {
      setRequest(null);
      onReady(provider);
      return;
    }
    const attempt = ++generation.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inFlight.current = scope;
    setRequest({ scope, provider, failed: false, attempt, opener });
    let module: Awaited<ReturnType<ProviderContactsLoader>>;
    try {
      module = await load();
    } catch {
      if (attempt !== generation.current || !isCurrentSession(actorId, sessionVersion)) return;
      setRequest({ scope, provider, failed: true, attempt, opener });
      sileo.error({ title: i18n.t("provider_contacts:load_error") });
      return;
    } finally {
      if (attempt === generation.current) inFlight.current = null;
    }
    if (attempt !== generation.current || !isCurrentSession(actorId, sessionVersion)) return;
    setComponent(() => module.default);
    setRequest(null);
    onReady(provider);
  };

  const current = request?.scope === scope ? request : null;
  return {
    Component,
    open,
    loadingProviderId: current && !current.failed ? current.provider.id : null,
    failedProvider: current?.failed ? current.provider : null,
  };
}
