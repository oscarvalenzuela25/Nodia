import { describe, expect, it } from 'vitest';
import { ObserveNodiaAiEligibilityUseCase } from './observe-nodia-ai-eligibility.use-case.js';
import { connectionFixture } from './nodia-ai-connections.fixture.js';
import { testIdentity } from './conversation-admission.fixture.js';
import { NodiaAiAdapterError } from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import type { LoadNodiaAiKnowledgeUseCase } from '../../nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case.js';

const input = { mode: 'agentic', model_id: 'synthetic-agentic' };
describe('ObserveNodiaAiEligibilityUseCase', () => {
  it.each([
    {
      published: true,
      business: true,
      mcp: true,
      available: true,
      allowed: true,
    },
    {
      published: false,
      business: true,
      mcp: true,
      available: true,
      allowed: false,
    },
    {
      published: true,
      business: false,
      mcp: true,
      available: true,
      allowed: false,
    },
    {
      published: true,
      business: true,
      mcp: false,
      available: true,
      allowed: false,
    },
    {
      published: true,
      business: true,
      mcp: true,
      available: false,
      allowed: false,
    },
  ])(
    'offers OCR references only for a published and currently usable authorized capability: %j',
    async (value) => {
      const f = connectionFixture();
      if (value.business)
        f.snapshot.modules.push({
          id: '3',
          key: 'business',
          route: '/business',
          assigned: true,
        });
      Object.assign(f.observation, {
        supportsMcp: value.mcp,
        available: value.available,
      });
      const knowledge = {
        manifest: {
          capability_contracts: value.published
            ? [{ capability_id: 'nodia_invoices_ocr' }]
            : [],
        },
      } as unknown as LoadNodiaAiKnowledgeUseCase;
      const result = await new ObserveNodiaAiEligibilityUseCase(
        f.connections,
        f.authorize,
        f.adapter,
        knowledge,
      ).execute(testIdentity, '2', {
        mode: 'agentic',
        model_id: 'synthetic-agentic',
      });
      if (value.allowed)
        expect(result.invoice_ocr).toEqual({
          media_types: [
            'image/png',
            'image/jpeg',
            'image/webp',
            'application/pdf',
          ],
          file_bytes: 10485760,
        });
      else expect(result).not.toHaveProperty('invoice_ocr');
      expect(JSON.stringify(result)).not.toContain(
        'verifiedAttachmentMediaTypes',
      );
    },
  );
  it('observes only exact OpenAI Agentic without proposing a Web delegation target', async () => {
    const f = connectionFixture();
    f.row.provider_key = 'openai';
    Object.assign(f.observation, {
      source: 'codex_live_session_and_catalog',
      adapterContractVersion: 'nodia-ai-codex-chat/1',
      resourceKey: 'codex-profile:' + 'a'.repeat(64),
      supportsMcp: false,
      adapterIdentity: {
        providerKey: 'openai',
        contractVersion: 'nodia-ai-codex-chat/1',
        connectionId: '2',
      },
    });
    const result = await new ObserveNodiaAiEligibilityUseCase(
      f.connections,
      f.authorize,
      f.adapter,
    ).execute(testIdentity, '2', {
      mode: 'agentic',
      model_id: 'synthetic-agentic',
    });
    expect(result).toMatchObject({
      available: true,
      supports_mcp: false,
      routing_target: null,
    });
    expect(f.transport.observe).toHaveBeenCalledExactlyOnceWith({
      connection_id: '2',
      mode: 'agentic',
      model_id: 'synthetic-agentic',
      effort_id: null,
    });
    expect(JSON.stringify(result)).not.toContain('codex-profile');
    expect(result).not.toHaveProperty('adapterIdentity');
  });
  it('does not promote configured OpenAI Agentic when its live observation is unavailable', async () => {
    const f = connectionFixture();
    f.row.provider_key = 'openai';
    f.transport.observe.mockRejectedValue(
      new NodiaAiAdapterError('session_required', 'not_dispatched'),
    );
    const result = await new ObserveNodiaAiEligibilityUseCase(
      f.connections,
      f.authorize,
      f.adapter,
    ).execute(testIdentity, '2', {
      mode: 'agentic',
      model_id: 'synthetic-agentic',
    });
    expect(result).toMatchObject({
      available: false,
      supports_mcp: false,
      routing_target: null,
      reason: 'nodia_ai:session_required',
    });
    expect(f.transport.observe).toHaveBeenCalledTimes(1);
  });
  it('checks another explicit effort without persisting global defaults or substituting the configured effort', async () => {
    const f = connectionFixture();
    const before = JSON.stringify(f.row.fields);
    await new ObserveNodiaAiEligibilityUseCase(
      f.connections,
      f.authorize,
      f.adapter,
    ).execute(testIdentity, '2', { ...input, effort_id: 'low' });
    expect(f.transport.observe).toHaveBeenNthCalledWith(1, {
      connection_id: '2',
      mode: 'agentic',
      model_id: 'synthetic-agentic',
      effort_id: 'low',
    });
    expect(JSON.stringify(f.row.fields)).toBe(before);
  });
  it('keeps an unsupported effort unavailable without dropping it or retrying inference', async () => {
    const f = connectionFixture();
    f.transport.observe.mockRejectedValue(
      new NodiaAiAdapterError('thinking_level_unsupported', 'not_dispatched'),
    );
    const result = await new ObserveNodiaAiEligibilityUseCase(
      f.connections,
      f.authorize,
      f.adapter,
    ).execute(testIdentity, '2', {
      mode: 'agentic',
      model_id: 'synthetic-agentic',
      effort_id: 'low',
    });
    expect(result).toMatchObject({
      available: false,
      reason: 'nodia_ai:thinking_level_unsupported',
      selection: { effort_id: 'low' },
      routing_target: null,
    });
    expect(f.transport.observe).toHaveBeenCalledTimes(1);
  });
  it('checks the exact selection and does not propose a delegation target', async () => {
    const f = connectionFixture();
    const result = await new ObserveNodiaAiEligibilityUseCase(
      f.connections,
      f.authorize,
      f.adapter,
    ).execute(testIdentity, '2', input);
    expect(f.transport.observe).toHaveBeenNthCalledWith(1, {
      connection_id: '2',
      mode: 'agentic',
      model_id: 'synthetic-agentic',
      effort_id: null,
    });
    expect(f.transport.observe).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      available: true,
      reason: null,
      routing_target: null,
    });
    expect(result).not.toHaveProperty('resource_key');
    expect(JSON.stringify(result)).not.toContain('gemini-profile');
  });
  it('cannot turn authenticated or available Agentic into MCP attestation', async () => {
    const f = connectionFixture();
    f.observation.supportsMcp = false;
    const result = await new ObserveNodiaAiEligibilityUseCase(
      f.connections,
      f.authorize,
      f.adapter,
    ).execute(testIdentity, '2', input);
    expect(result.routing_target).toBeNull();
    expect(result.supports_mcp).toBe(false);
  });
  it('does not substitute API or another provider and never observes disabled modes', async () => {
    const f = connectionFixture();
    const subject = new ObserveNodiaAiEligibilityUseCase(
      f.connections,
      f.authorize,
      f.adapter,
    );
    expect(
      await subject.execute(testIdentity, '2', {
        mode: 'api_key',
        model_id: 'synthetic-api',
      }),
    ).toMatchObject({
      available: false,
      reason: 'nodia_ai:adapter_unavailable',
      observed_at: null,
      routing_target: null,
    });
    f.row.provider_key = 'gemini';
    f.row.use_agentic = false;
    expect((await subject.execute(testIdentity, '2', input)).reason).toBe(
      'nodia_ai:adapter_connection_unavailable',
    );
    expect(f.transport.observe).toHaveBeenCalledTimes(1);
    expect(f.transport.observe).toHaveBeenCalledWith({
      connection_id: '2',
      mode: 'api_key',
      model_id: 'synthetic-api',
      effort_id: null,
    });
  });
  it('denies revocation after observation and returns no stale positive result', async () => {
    const f = connectionFixture();
    f.transport.observe.mockImplementation(async () => {
      f.snapshot.modules[0].assigned = false;
      return f.observation;
    });
    await expect(
      new ObserveNodiaAiEligibilityUseCase(
        f.connections,
        f.authorize,
        f.adapter,
      ).execute(testIdentity, '2', input),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('rejects changed mode configuration during observation', async () => {
    const f = connectionFixture();
    f.transport.observe.mockImplementation(async () => {
      f.row.use_agentic = false;
      return f.observation;
    });
    await expect(
      new ObserveNodiaAiEligibilityUseCase(
        f.connections,
        f.authorize,
        f.adapter,
      ).execute(testIdentity, '2', input),
    ).rejects.toThrow('nodia_ai:eligibility_changed');
  });
  it('returns explicit unavailable for adapter failure without leaking transport text', async () => {
    const f = connectionFixture();
    f.transport.observe.mockRejectedValue(
      new Error('synthetic-sensitive-upstream'),
    );
    const result = await new ObserveNodiaAiEligibilityUseCase(
      f.connections,
      f.authorize,
      f.adapter,
    ).execute(testIdentity, '2', input);
    expect(result).toMatchObject({
      available: false,
      reason: 'nodia_ai:adapter_unavailable',
      observed_at: null,
      supports_mcp: false,
      routing_target: null,
    });
    expect(JSON.stringify(result)).not.toContain('synthetic-sensitive');
  });
  it('reports mismatch as conflict rather than silently changing model or mode', async () => {
    const f = connectionFixture();
    f.transport.observe.mockRejectedValue(
      new NodiaAiAdapterError(
        'adapter_configuration_changed',
        'not_dispatched',
      ),
    );
    await expect(
      new ObserveNodiaAiEligibilityUseCase(
        f.connections,
        f.authorize,
        f.adapter,
      ).execute(testIdentity, '2', input),
    ).rejects.toMatchObject({ status: 409 });
  });
  it.each([
    { ...input, model_id: 'not-configured' },
    { ...input, model_id: '' },
    { ...input, effort_id: null },
    { ...input, actor: '2' },
    { ...input, mode: 'token_plan_web' },
  ])(
    'rejects invalid exact selection %j before external observation',
    async (query) => {
      const f = connectionFixture();
      await expect(
        new ObserveNodiaAiEligibilityUseCase(
          f.connections,
          f.authorize,
          f.adapter,
        ).execute(testIdentity, '2', query),
      ).rejects.toMatchObject({ status: 400 });
      expect(f.transport.observe).not.toHaveBeenCalled();
    },
  );
});

it.each([false, true])(
  'API eligibility exposes qualified image generation=%s without claiming native MCP or inferred formats',
  async (supportsImageGeneration) => {
    const f = connectionFixture();
    Object.assign(f.observation, {
      source: 'api_configuration_and_catalog',
      adapterContractVersion: 'nodia-ai-api-chat/1',
      resourceKey: 'api-connection:' + 'a'.repeat(64),
      supportsMcp: false,
      supportsTools: true,
      supportsImageGeneration,
      adapterIdentity: {
        providerKey: 'gemini',
        contractVersion: 'nodia-ai-api-chat/1',
        connectionId: '2',
      },
      verifiedAttachmentMediaTypes: [],
    });
    const result = await new ObserveNodiaAiEligibilityUseCase(
      f.connections,
      f.authorize,
      f.adapter,
    ).execute(testIdentity, '2', {
      mode: 'api_key',
      model_id: 'synthetic-api',
    });
    expect(result).toMatchObject({
      available: true,
      reason: null,
      supports_mcp: false,
      supports_tools: true,
      supports_image_generation: supportsImageGeneration,
      routing_target: null,
    });
    expect(result).not.toHaveProperty('native_media_types');
    expect(result).not.toHaveProperty('resource_key');
    expect(f.transport.observe).toHaveBeenCalledExactlyOnceWith({
      connection_id: '2',
      mode: 'api_key',
      model_id: 'synthetic-api',
      effort_id: null,
    });
  },
);
