import { ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import type { ApiTextGenerationService } from '../../ai-generation/api-text-generation.service.js';
import type { NodiaAiRuntimePolicy } from '../../nodia-ai-runtime/config/runtime-policy.js';
import { CV_GEMINI_PROMPT_BYTES } from '../agentic/nodia-cv-agentic-provider.js';
import type { StartNodiaCvGenerationDto } from '../dto/nodia-cv-generation.dto.js';
import { prepareCvTailoring } from '../engine/index.js';
import type { NodiaCvGenerationScope } from '../nodia-cv-generation-scope.service.js';
import type { NodiaCvGenerationStore } from '../nodia-cv-generation.store.js';
import type { NodiaCvProfilesService } from '../nodia-cv-profiles.service.js';
import type { NodiaCvSelectionService } from '../nodia-cv-selection.service.js';
import {
  CV_PROBE_CANDIDATE,
  CV_PROBE_OFFER,
  cvGenerationIntent,
  cvGenerationPrompt,
} from '../policies/nodia-cv-generation.js';
import type { CvAgenticConfiguration } from '../types/nodia-cv-generation.types.js';
import type { NodiaCvProfileData } from '../types/nodia-cv-profile.types.js';
import { NodiaCvGenerationsUseCase } from './nodia-cv-generations.use-case.js';

const actor = {
  userId: '1',
  sessionId: '11111111-1111-4111-8111-111111111111',
};
const input: StartNodiaCvGenerationDto = {
  profile_id: '22222222-2222-4222-8222-222222222222',
  profile_revision: 1,
  request_key: '33333333-3333-4333-8333-333333333333',
  language: 'en',
  offer_text: CV_PROBE_OFFER,
  selection: {
    connection_id: '2',
    mode: 'agentic',
    model_id: 'synthetic-codex-model',
    effort_id: 'high',
  },
};

function fixture(
  isSuperAdmin: boolean,
  additionalSections: NodiaCvProfileData['additional_sections'] = [],
) {
  const current = { ...actor, actorId: actor.userId, isSuperAdmin };
  const profile = {
    id: input.profile_id,
    revision: input.profile_revision,
    profile_name: 'Synthetic canary',
    full_name: CV_PROBE_CANDIDATE,
    data: {
      main_stack: ['TypeScript'],
      contact: {},
      experiences: [],
      projects: [],
      skill_areas: [],
      education: [],
      certifications: [],
      languages: [],
      additional_sections: additionalSections,
    },
  };
  const row = {
    id: '44444444-4444-4444-8444-444444444444',
    state: 'queued',
    profile_id: input.profile_id,
    profile_revision: input.profile_revision,
    request_hash: cvGenerationIntent(input),
    expires_at: new Date(Date.now() + 120_000),
    selection_snapshot: input.selection,
    qualification: false,
  };
  const config: CvAgenticConfiguration = {
    providerKey: 'openai',
    connectionId: input.selection.connection_id,
    keyId: null,
    configurationGeneration: 'a'.repeat(64),
    sessionGeneration: 'b'.repeat(32),
    resourceKey: 'codex-profile:' + 'c'.repeat(64),
    policyHash: 'd'.repeat(64),
    runtimeHash: 'e'.repeat(64),
  };
  const manager = {} as EntityManager;
  let inTransaction = false;
  const authorize = vi.fn().mockResolvedValue(current);
  const scope = {
    authorize,
    async transaction<T>(work: (manager: EntityManager) => Promise<T>) {
      expect(inTransaction).toBe(false);
      inTransaction = true;
      try {
        return await work(manager);
      } finally {
        inTransaction = false;
      }
    },
  };
  const store = {
    status: vi.fn().mockResolvedValue(null),
    admit: vi.fn().mockResolvedValue(row),
    checkQueue: vi.fn(),
  };
  const selections = {
    observeAgentic: vi.fn(async () => {
      expect(inTransaction).toBe(false);
      return {};
    }),
    configureAgentic: vi.fn(async () => {
      expect(inTransaction).toBe(true);
      return config;
    }),
    configure: vi.fn(),
    scopeHash: vi.fn(() => 'scope'),
  };
  const measure = vi.fn();
  const useCase = new NodiaCvGenerationsUseCase(
    scope as unknown as NodiaCvGenerationScope,
    store as unknown as NodiaCvGenerationStore,
    {
      find: vi.fn().mockResolvedValue(profile),
    } as unknown as NodiaCvProfilesService,
    selections as unknown as NodiaCvSelectionService,
    { measure } as unknown as ApiTextGenerationService,
    {
      queue: { wait_seconds: 1 },
      timing: { provider_dispatch_seconds: 5 },
    } as NodiaAiRuntimePolicy,
  );
  return {
    authorize,
    config,
    measure,
    profile,
    row,
    selections,
    store,
    useCase,
  };
}

describe('Nodia CV Agentic admission', () => {
  it('accounts for the Gemini finish framing before admitting an otherwise valid Agentic prompt', async () => {
    const additionalSections = Array.from({ length: 6 }, (_, section) => ({
      id: randomUUID(),
      title: 'Synthetic section ' + section,
      lines: Array.from(
        { length: 30 },
        (_, line) => 'Synthetic line ' + line + ' ' + 'x'.repeat(440),
      ),
    }));
    const f = fixture(false, additionalSections);
    f.selections.observeAgentic.mockResolvedValue({ provider: 'gemini' });
    const { data, ...header } = f.profile;
    const prepared = prepareCvTailoring({
      profile: {
        ...header,
        ...data,
        schema_version: 1,
        created_at: new Date(0),
        updated_at: new Date(0),
      },
      offer: input.offer_text,
      locale: input.language,
    });
    const available =
      CV_GEMINI_PROMPT_BYTES - Buffer.byteLength(cvGenerationPrompt(prepared));
    const request = {
      ...input,
      // A literal backslash consumes two UTF-8 bytes when encoded inside the offer JSON.
      offer_text: input.offer_text + '\\'.repeat(Math.floor(available / 2)),
    };
    await expect(f.useCase.start(actor, request)).rejects.toThrow(
      'generation_input_too_large',
    );
    expect(f.store.admit).not.toHaveBeenCalled();
    expect(f.selections.configureAgentic).not.toHaveBeenCalled();

    await expect(
      fixture(false, additionalSections).useCase.start(actor, request),
    ).resolves.toMatchObject({
      state: 'queued',
    });
  });

  it('observes the provider outside SQL and admits ordinary work with the exact live configuration', async () => {
    const f = fixture(false);
    await expect(f.useCase.start(actor, input)).resolves.toMatchObject({
      state: 'queued',
    });
    expect(f.store.admit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        qualification: false,
        config: f.config,
        scopeHash: 'scope',
      }),
    );
    expect(f.authorize).toHaveBeenCalledTimes(2);
    expect(f.selections.configureAgentic).toHaveBeenCalledOnce();
    expect(f.selections.configure).not.toHaveBeenCalled();
  });

  it('checks the admin probe owner and designated offer before touching Codex', async () => {
    const noAdmin = fixture(false);
    await expect(noAdmin.useCase.startProbe(actor, input)).rejects.toThrow(
      'generation_probe_forbidden',
    );
    expect(noAdmin.selections.observeAgentic).not.toHaveBeenCalled();

    const f = fixture(true);
    await expect(
      f.useCase.startProbe(actor, { ...input, offer_text: 'different' }),
    ).rejects.toThrow('generation_probe_invalid');
    expect(f.selections.observeAgentic).not.toHaveBeenCalled();
    await expect(f.useCase.startProbe(actor, input)).resolves.toMatchObject({
      state: 'queued',
    });
    expect(f.store.admit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        qualification: true,
        config: f.config,
        owner: actor.userId,
      }),
    );
    expect(f.measure).not.toHaveBeenCalled();
  });

  it('returns an admitted intention or rejects a different payload without depending on provider availability', async () => {
    const f = fixture(false);
    f.store.status.mockResolvedValue(f.row);
    await expect(f.useCase.start(actor, input)).resolves.toMatchObject({
      id: f.row.id,
    });
    await expect(
      f.useCase.start(actor, { ...input, offer_text: 'changed' }),
    ).rejects.toThrow('request_key_conflict');
    expect(f.selections.observeAgentic).not.toHaveBeenCalled();
    expect(f.store.admit).not.toHaveBeenCalled();
  });

  it('rejects a caller whose authority was revoked during Codex observation', async () => {
    const f = fixture(true);
    f.authorize
      .mockResolvedValueOnce({
        actorId: actor.userId,
        sessionId: actor.sessionId,
        isSuperAdmin: true,
      })
      .mockRejectedValueOnce(new ForbiddenException('revoked'));
    await expect(f.useCase.startProbe(actor, input)).rejects.toThrow('revoked');
    expect(f.selections.observeAgentic).toHaveBeenCalledOnce();
    expect(f.selections.configureAgentic).not.toHaveBeenCalled();
    expect(f.store.admit).not.toHaveBeenCalled();
  });
});
