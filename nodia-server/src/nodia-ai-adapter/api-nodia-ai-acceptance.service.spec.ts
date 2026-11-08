import { describe, expect, it, vi } from 'vitest';
import type { DataSource } from 'typeorm';
import {
  ApiNodiaAiAcceptanceService,
  apiAcceptanceScope,
} from './api-nodia-ai-acceptance.service.js';
import type { ApiNodiaAiCredentialsService } from './api-nodia-ai-credentials.service.js';
import type { ApiNodiaAiRuntimeService } from './api-nodia-ai-runtime.service.js';
import type {
  NodiaAiAdapterReply,
  NodiaAiAdapterRequest,
} from './types/nodia-ai-adapter.types.js';
function setup() {
  const config = {
    providerKey: 'openai' as const,
    connectionId: '4',
    keyId: '5',
    configurationGeneration: 'c'.repeat(64),
    resourceKey: 'api-connection:' + 'a'.repeat(64),
    sessionGeneration: 'b'.repeat(32),
  };
  const request: NodiaAiAdapterRequest = {
    selection: {
      connection_id: '4',
      mode: 'api_key',
      model_id: 'fixture-model',
      effort_id: null,
    },
    attemptId: 'a87b3197-5968-473f-8e5e-c6b4935b6771',
    canonicalPrompt:
      'Read hidden marker from the attachment and return nonce_fixture_123456',
    deadlineAt: new Date(Date.now() + 10000),
    resourceKey: config.resourceKey,
    sessionGeneration: config.sessionGeneration,
    configurationGeneration: config.configurationGeneration,
    attachments: [
      {
        kind: 'pdf',
        media_type: 'application/pdf',
        sha256: 'd'.repeat(64),
        content_base64: 'c3ludGhldGlj',
      },
    ],
  };
  const reply: NodiaAiAdapterReply = {
    kind: 'answer',
    text: 'nonce_fixture_123456 SYNTHETIC_ORACLE',
    terminalProof: {
      engine: 'api_key',
      attemptId: request.attemptId,
      operationRef: request.attemptId,
      resourceKey: config.resourceKey,
      sessionGeneration: config.sessionGeneration,
      adapterIdentity: {
        providerKey: 'openai',
        contractVersion: 'nodia-ai-api-chat/1',
        connectionId: '4',
      },
      terminalProofId: '1d73e810-dfe3-4f9f-8557-5f2363bbd6fd',
      localTransportClosed: true,
      remoteOutcome: 'completed',
      outcome: 'completed',
      observedAt: new Date(),
    },
  };
  const query = vi.fn(
    async (
      sql: string,
      _parameters?: unknown[],
    ): Promise<Record<string, unknown>[]> =>
      sql.includes('INSERT INTO')
        ? [{ scope_hash: apiAcceptanceScope(config, request.selection) }]
        : [],
  );
  const configuration = vi.fn().mockResolvedValue(config);
  const reconcile = vi.fn().mockResolvedValue(reply.terminalProof);
  const assertCompletedRequest = vi.fn().mockResolvedValue({
    requestHash: 'a'.repeat(64),
    responseHash: 'b'.repeat(64),
  });
  const service = new ApiNodiaAiAcceptanceService(
    { manager: { query } } as unknown as DataSource,
    { configuration } as unknown as ApiNodiaAiCredentialsService,
    {
      reconcile,
      assertCompletedRequest,
    } as unknown as ApiNodiaAiRuntimeService,
  );
  const canary = {
    nonce: 'nonce_fixture_123456',
    expectedText: ['SYNTHETIC_ORACLE'],
    mediaType: 'application/pdf',
  };
  return {
    config,
    request,
    reply,
    query,
    configuration,
    reconcile,
    assertCompletedRequest,
    service,
    canary,
    signal: new AbortController().signal,
  };
}
describe('API exact-scope private qualification', () => {
  it('rejects a canary whose supposedly hidden oracle was already disclosed in the prompt', () => {
    const f = setup();
    f.request.canonicalPrompt += ' SYNTHETIC_ORACLE';
    expect(() => f.service.validateCanary(f.request, f.canary)).toThrow(
      'api_acceptance_invalid',
    );
    expect(f.query).not.toHaveBeenCalled();
  });
  it('refuses post-hoc request/reply changes when the durable response binding disagrees', async () => {
    const f = setup();
    f.assertCompletedRequest.mockRejectedValue(
      Error('nodia_ai:api_qualification_payload_mismatch'),
    );
    await expect(
      f.service.qualify(f.config, f.request, f.reply, f.canary, f.signal),
    ).rejects.toThrow('api_qualification_payload_mismatch');
    expect(f.query).not.toHaveBeenCalled();
  });
  it('defaults to no attachment or image qualification and performs no provider requests', async () => {
    const f = setup();
    expect(await f.service.read(f.config, f.request.selection)).toEqual({
      verifiedMediaTypes: [],
      imageGeneration: false,
      observedAt: null,
    });
    expect(f.reconcile).not.toHaveBeenCalled();
  });
  it('invalidates acceptance for any exact scope change, including model/effort and key epoch', () => {
    const f = setup();
    const original = apiAcceptanceScope(f.config, f.request.selection);
    for (const changed of [
      { ...f.config, providerKey: 'gemini' as const },
      { ...f.config, connectionId: '6' },
      { ...f.config, sessionGeneration: 'e'.repeat(32) },
      { ...f.config, configurationGeneration: 'f'.repeat(64) },
    ])
      expect(apiAcceptanceScope(changed, f.request.selection)).not.toBe(
        original,
      );
    expect(
      apiAcceptanceScope(f.config, {
        ...f.request.selection,
        model_id: 'another-fixture',
      }),
    ).not.toBe(original);
    expect(
      apiAcceptanceScope(f.config, {
        ...f.request.selection,
        effort_id: 'low',
      }),
    ).not.toBe(original);
  });
  it('requires a durable completed proof, nonce and actual oracle before persisting sanitized hashes only', async () => {
    const f = setup();
    await f.service.qualify(f.config, f.request, f.reply, f.canary, f.signal);
    expect(f.reconcile).toHaveBeenCalledOnce();
    const insert = f.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO'),
    );
    expect(insert).toBeDefined();
    const parameters = insert?.[1];
    if (!parameters || typeof parameters[9] !== 'string')
      throw Error('Expected a bound evidence insert');
    expect(parameters[7]).toEqual(['application/pdf']);
    expect(parameters[8]).toBe(false);
    const evidence = JSON.parse(parameters[9])['application/pdf'];
    expect(evidence).toMatchObject({
      input_sha256: 'd'.repeat(64),
      media_type: 'application/pdf',
    });
    expect(JSON.stringify(evidence)).not.toContain(f.canary.nonce);
    expect(JSON.stringify(evidence)).not.toContain('SYNTHETIC_ORACLE');
    expect(evidence.nonce_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(insert![0]).toContain('evidence || EXCLUDED.evidence');
    expect(insert![0]).toContain('octet_length');
  });
  it.each(['nonce', 'oracle', 'epoch', 'remote_unknown', 'proof_id'])(
    'does not qualify %s mismatches',
    async (change) => {
      const f = setup();
      if (change === 'nonce' && f.reply.kind === 'answer')
        f.reply.text = 'SYNTHETIC_ORACLE';
      if (change === 'oracle' && f.reply.kind === 'answer')
        f.reply.text = f.canary.nonce;
      if (change === 'epoch')
        f.configuration.mockResolvedValue({
          ...f.config,
          configurationGeneration: 'e'.repeat(64),
        });
      if (
        change === 'remote_unknown' &&
        f.reply.terminalProof.engine === 'api_key'
      )
        f.reply.terminalProof.remoteOutcome = 'unknown';
      if (change === 'proof_id')
        f.reconcile.mockResolvedValue({
          ...f.reply.terminalProof,
          terminalProofId: 'a87b3197-5968-473f-8e5e-c6b4935b6771',
        });
      await expect(
        f.service.qualify(f.config, f.request, f.reply, f.canary, f.signal),
      ).rejects.toThrow();
      expect(f.query.mock.calls.some(([sql]) => sql.includes('INSERT'))).toBe(
        false,
      );
    },
  );
  it('never derives image generation qualification from image input acceptance', async () => {
    const f = setup();
    f.query.mockResolvedValue([
      {
        verified_media_types: ['image/png'],
        image_generation: false,
        observed_at: new Date(),
      },
    ]);
    expect(await f.service.read(f.config, f.request.selection)).toMatchObject({
      verifiedMediaTypes: ['image/png'],
      imageGeneration: false,
    });
  });
  it('refuses an atomic merge that would exceed the aggregate audit limit', async () => {
    const f = setup();
    f.query.mockResolvedValueOnce([]);
    await expect(
      f.service.qualify(f.config, f.request, f.reply, f.canary, f.signal),
    ).rejects.toThrow('api_acceptance_invalid');
  });
});
