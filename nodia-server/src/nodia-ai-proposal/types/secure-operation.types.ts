import type { NodiaAiProposalPreparer } from './proposal-preparer.types.js';

export type NodiaAiSecureFlowKind =
  | 'api_key_create'
  | 'api_key_update'
  | 'api_key_delete'
  | 'connection_login'
  | 'nodia_logout'
  | 'codex_logout'
  | 'gemini_web_logout'
  | 'sync_models';

export interface NodiaAiSecureOperation extends NodiaAiProposalPreparer {
  readonly kind: NodiaAiSecureFlowKind;
  reprepareStored: NonNullable<NodiaAiProposalPreparer['reprepareStored']>;
}

export const NODIA_AI_SECURE_OPERATIONS = Symbol('NODIA_AI_SECURE_OPERATIONS');

const identities: Readonly<
  Record<
    string,
    Readonly<{
      kind: NodiaAiSecureFlowKind;
      providerRequired: boolean;
      keyRequired: boolean;
      modeRequired: boolean;
    }>
  >
> = Object.freeze({
  nodia_secure_flows_prepare_api_key_create: {
    kind: 'api_key_create',
    providerRequired: true,
    keyRequired: false,
    modeRequired: false,
  },
  nodia_secure_flows_prepare_api_key_update: {
    kind: 'api_key_update',
    providerRequired: true,
    keyRequired: true,
    modeRequired: false,
  },
  nodia_api_keys_prepare_delete: {
    kind: 'api_key_delete',
    providerRequired: true,
    keyRequired: true,
    modeRequired: false,
  },
  nodia_secure_flows_prepare_connection_login: {
    kind: 'connection_login',
    providerRequired: true,
    keyRequired: false,
    modeRequired: true,
  },
  nodia_secure_flows_prepare_nodia_logout: {
    kind: 'nodia_logout',
    providerRequired: false,
    keyRequired: false,
    modeRequired: false,
  },
  nodia_ai_providers_prepare_codex_logout: {
    kind: 'codex_logout',
    providerRequired: true,
    keyRequired: false,
    modeRequired: false,
  },
  nodia_ai_providers_prepare_gemini_web_logout: {
    kind: 'gemini_web_logout',
    providerRequired: true,
    keyRequired: false,
    modeRequired: false,
  },
  nodia_ai_providers_prepare_sync_models: {
    kind: 'sync_models',
    providerRequired: true,
    keyRequired: false,
    modeRequired: true,
  },
});

export function nodiaAiSecureOperationIdentity(name: string) {
  return Object.hasOwn(identities, name) ? identities[name] : null;
}
