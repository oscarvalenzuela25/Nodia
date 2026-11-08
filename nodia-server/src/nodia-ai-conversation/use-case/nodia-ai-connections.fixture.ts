import { vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import type { NodiaAiAuthorizationService } from '../../nodia-ai/nodia-ai-authorization.service.js';
import {
  NodiaAiConnectionsService,
  type NodiaAiConnectionConfiguration,
} from '../nodia-ai-connections.service.js';
import {
  NodiaAiAdapterPort,
  type NodiaAiAdapterObservation,
} from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import {
  conversationFixture,
  testIdentity,
  testNow,
} from './conversation-admission.fixture.js';
export function connectionFixture() {
  const snapshot = {
    actorId: '1',
    sessionId: testIdentity.sessionId,
    isSuperAdmin: false,
    modules: [
      { id: '2', key: 'nodia_ai', route: '/nodia-ai', assigned: true },
    ],
    actionKeys: [],
  };
  const authorization = { loadCurrentActor: vi.fn(async () => snapshot) };
  const authorize = new AuthorizeNodiaAiUseCase(
    authorization as unknown as NodiaAiAuthorizationService,
  );
  const query = vi.fn(async () => []);
  const manager = { query } as unknown as EntityManager;
  const row: NodiaAiConnectionConfiguration = {
    id: '2',
    label: 'Synthetic connection',
    provider_key: 'gemini',
    is_active: true,
    is_default: false,
    default_mode: null,
    catalog_active: true,
    use_api_key: true,
    use_agentic: true,
    can_use_api_key: true,
    can_use_agentic: true,
    fields: {
      agentic: {
        selected_model: 'synthetic-agentic',
        thinking_level: 'synthetic-effort',
        available_models: [{ id: 'synthetic-agentic' }],
      },
      api_key: { selected_model: 'synthetic-api' },
    },
  };
  const storage = {
    transaction: vi.fn(async (work: (m: EntityManager) => Promise<unknown>) =>
      work(manager),
    ),
    list: vi.fn(async () => [row]),
    find: vi.fn(async () => row as NodiaAiConnectionConfiguration | null),
  };
  const connections = storage as unknown as NodiaAiConnectionsService;
  const observation: NodiaAiAdapterObservation = {
    available: true,
    observedAt: testNow,
    source: 'gemini_live_session_and_catalog',
    resourceKey: 'gemini-profile:' + 'a'.repeat(64),
    configurationGeneration: 'b'.repeat(64),
    sessionGeneration: 'c'.repeat(32),
    adapterContractVersion: 'nodia-ai-gemini-chat/1',
    supportsMcp: true,
    reason: null,
  };
  const transport = {
    observe: vi.fn(async () => observation),
    verifyConfiguration: vi.fn(async () => undefined),
  };
  return {
    row,
    snapshot,
    authorization,
    authorize,
    storage,
    connections,
    manager,
    transport,
    observation,
    adapter: transport as unknown as NodiaAiAdapterPort,
    policy: conversationFixture().policy,
  };
}
