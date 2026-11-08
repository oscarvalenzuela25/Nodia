import type { NodiaAiAdapterObservation } from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import type {
  NodiaAiSelection,
  NodiaAiJsonObject,
} from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type { NodiaAiRuntimeReservation } from '../../nodia-ai-runtime/types/worker.types.js';
import { NodiaAiKnownPreDispatchError } from '../../nodia-ai-runtime/types/worker.types.js';
import { runtimeProofDescriptor } from '../../nodia-ai-runtime/use-case/runtime-reconciliation-descriptor.js';

/** Legacy Gemini observations omit identity; Codex must supply its explicit private contract. */
export function observationIdentity(
  selection: NodiaAiSelection,
  observation: NodiaAiAdapterObservation,
): NodiaAiRuntimeReservation['adapterIdentity'] {
  const identity = observation.adapterIdentity;
  if (
    selection.mode === 'api_key' ||
    observation.source === 'api_configuration_and_catalog'
  ) {
    if (
      selection.mode !== 'api_key' ||
      observation.source !== 'api_configuration_and_catalog' ||
      observation.adapterContractVersion !== 'nodia-ai-api-chat/1' ||
      !identity ||
      identity.contractVersion !== 'nodia-ai-api-chat/1' ||
      !['openai', 'gemini'].includes(identity.providerKey) ||
      identity.connectionId !== selection.connection_id ||
      !/^[1-9][0-9]{0,18}$/.test(identity.connectionId) ||
      BigInt(identity.connectionId) > 9223372036854775807n ||
      Object.keys(identity).length !== 3 ||
      typeof observation.resourceKey !== 'string' ||
      !/^api-connection:[a-f0-9]{64}$/.test(observation.resourceKey) ||
      !/^[a-f0-9]{32}$/.test(observation.sessionGeneration) ||
      observation.supportsMcp !== false
    )
      throw new NodiaAiKnownPreDispatchError('nodia_ai:eligibility_changed');
    return { ...identity };
  }
  if (
    observation.adapterContractVersion !== 'nodia-ai-codex-chat/1' &&
    identity === undefined
  ) {
    if (
      observation.resourceKey?.startsWith('codex-profile:') ||
      (observation.adapterContractVersion !== undefined &&
        observation.adapterContractVersion !== 'nodia-ai-gemini-chat/1')
    )
      throw new NodiaAiKnownPreDispatchError('nodia_ai:eligibility_changed');
    return undefined;
  }
  if (
    observation.adapterContractVersion !== 'nodia-ai-codex-chat/1' ||
    observation.source !== 'codex_live_session_and_catalog' ||
    selection.mode !== 'agentic' ||
    !identity ||
    identity.providerKey !== 'openai' ||
    identity.contractVersion !== 'nodia-ai-codex-chat/1' ||
    identity.connectionId !== selection.connection_id ||
    !/^[1-9][0-9]{0,18}$/.test(identity.connectionId) ||
    BigInt(identity.connectionId) > 9223372036854775807n ||
    typeof observation.resourceKey !== 'string' ||
    !/^codex-profile:[a-f0-9]{64}$/.test(observation.resourceKey) ||
    !/^[a-f0-9]{32}$/.test(observation.sessionGeneration) ||
    Object.keys(identity).length !== 3
  )
    throw new NodiaAiKnownPreDispatchError('nodia_ai:eligibility_changed');
  return { ...identity };
}

export function observationIdentityManifest(
  selection: NodiaAiSelection,
  observation: NodiaAiAdapterObservation,
): NodiaAiJsonObject {
  const identity = observationIdentity(selection, observation);
  return identity
    ? {
        adapter_identity: {
          provider_key: identity.providerKey,
          contract_version: identity.contractVersion,
          connection_id: identity.connectionId,
        },
      }
    : {};
}

export function bindObservationReservation(
  selection: NodiaAiSelection,
  observation: NodiaAiAdapterObservation,
  reservation: NodiaAiRuntimeReservation,
  attemptId: string,
): NodiaAiRuntimeReservation {
  const identity = observationIdentity(selection, observation);
  if (!identity) return reservation;
  // Validate the complete descriptor before arming; the prefix alone never selects a provider.
  const reference = {
    attemptId,
    operationRef: reservation.operationRef,
    resourceKey: reservation.resourceKey,
    sessionGeneration: observation.sessionGeneration,
  };
  runtimeProofDescriptor(
    identity.contractVersion === 'nodia-ai-api-chat/1'
      ? { ...reference, engine: 'api_key', adapterIdentity: identity }
      : { ...reference, engine: 'agentic', adapterIdentity: identity },
  );
  return {
    ...reservation,
    adapterIdentity: identity,
    sessionGeneration: observation.sessionGeneration,
  };
}

export function observationMatchesManifest(
  selection: NodiaAiSelection,
  observation: NodiaAiAdapterObservation,
  manifest: NodiaAiJsonObject,
): boolean {
  const expected = observationIdentityManifest(
    selection,
    observation,
  ).adapter_identity;
  const stored = manifest.adapter_identity;
  if (expected === undefined) return stored === undefined;
  if (
    !stored ||
    typeof stored !== 'object' ||
    Array.isArray(stored) ||
    Object.keys(stored).length !== 3
  )
    return false;
  return (
    JSON.stringify(Object.entries(stored).sort()) ===
    JSON.stringify(Object.entries(expected as NodiaAiJsonObject).sort())
  );
}
