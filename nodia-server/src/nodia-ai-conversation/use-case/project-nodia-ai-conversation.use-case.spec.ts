import { describe, expect, it } from 'vitest';
import type { NodiaAiConversation } from '../entities/nodia-ai-conversation.entity.js';
import { ProjectNodiaAiConversationUseCase } from './project-nodia-ai-conversation.use-case.js';
const now = new Date('2026-10-15T10:00:00Z');
function entity(extra: object = {}) {
  return {
    id: '15f71e5b-1a66-4a9d-8d79-dc64358adac7',
    owner_id: '9007199254740993',
    title: null,
    is_pinned: false,
    is_archived: false,
    revision: 1,
    selected_connection_id: null,
    selected_mode: null,
    selected_model_id: null,
    selected_effort_id: null,
    routing_enabled: false,
    routing_revision: 1,
    routing_target_selection: null,
    last_owner_message_at: null,
    created_at: now,
    updated_at: now,
    expires_at: now,
    creation_request_hash: 'synthetic-private-hash',
    retention_epoch: '1',
    active_job_id: 'synthetic-private-job',
    secret: 'synthetic-private-secret',
    ...extra,
  } as unknown as NodiaAiConversation;
}
describe('ProjectNodiaAiConversationUseCase', () => {
  it.each([
    { routing_target_selection: false },
    { routing_target_selection: undefined },
    { routing_enabled: true },
    { routing_revision: 0 },
    { routing_revision: undefined },
    {
      selected_connection_id: '1',
      selected_mode: 'unknown',
      selected_model_id: 'synthetic',
    },
    {
      selected_connection_id: null,
      selected_mode: 'unknown',
      selected_model_id: 'synthetic',
    },
    {
      routing_target_selection: {
        selection: null,
        configuration_generation: '1',
        session_generation: '1',
      },
    },
    {
      routing_target_selection: {
        selection: {
          connection_id: '1',
          mode: 'api_key',
          model_id: 'synthetic',
          effort_id: null,
        },
        configuration_generation: '1',
        session_generation: '1',
      },
    },
    {
      routing_target_selection: {
        selection: {
          connection_id: '1',
          mode: 'agentic',
          model_id: 'synthetic',
        },
        configuration_generation: '1',
        session_generation: '1',
      },
    },
  ])('fails closed on malformed persisted selection/routing (%j)', (value) => {
    expect(() =>
      new ProjectNodiaAiConversationUseCase().execute(entity(value)),
    ).toThrow('nodia_ai:invalid_persisted_state');
  });
  it('projects a closed summary preserving bigint precision and known false/null', () => {
    const result = new ProjectNodiaAiConversationUseCase().execute(
      entity(),
      true,
    );
    expect(result).toEqual({
      conversation_id: '15f71e5b-1a66-4a9d-8d79-dc64358adac7',
      owner_user_id: '9007199254740993',
      title: null,
      is_pinned: false,
      is_archived: false,
      revision: 1,
      selection: null,
      routing: { schema_version: 1, enabled: false, revision: 1, target: null },
      last_owner_message_at: null,
      expires_at: now.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      read_only: true,
    });
    expect(JSON.stringify(result)).not.toContain('synthetic-private');
  });
  it('does not expose arbitrary fields nested in a persisted target', () => {
    const result = new ProjectNodiaAiConversationUseCase().execute(
      entity({
        selected_connection_id: '1',
        selected_mode: 'agentic',
        selected_model_id: 'configured-source',
        routing_target_selection: {
          selection: {
            connection_id: '1',
            mode: 'agentic',
            model_id: 'configured-target',
            effort_id: null,
            api_key: 'synthetic-private-key',
          },
          configuration_generation: 'configuration-1',
          session_generation: 'session-1',
          token: 'synthetic-private-token',
        },
      }),
    );
    expect(result.selection?.effort_id).toBeNull();
    expect(result.routing.target?.selection.model_id).toBe('configured-target');
    expect(JSON.stringify(result)).not.toContain('synthetic-private');
  });
});
