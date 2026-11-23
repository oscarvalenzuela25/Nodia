import { createHash } from 'node:crypto';
import { createCanvas } from '@napi-rs/canvas';
import { imageSize } from 'image-size';
import type { DataSource, EntityManager } from 'typeorm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  ApiNodiaAiCredentialsService,
  NodiaAiApiConfiguration,
} from '../nodia-ai-adapter/api-nodia-ai-credentials.service.js';
import type { NodiaAiRuntimePolicy } from '../nodia-ai-runtime/config/runtime-policy.js';
import { FLASHCARD_IMAGE_MAX_BYTES } from '../teacher/policies/teacher-flashcards.js';
import type { TeacherSelection } from '../teacher/types/teacher.types.js';
import type { AiGenerationExecutionContext } from './ai-generation-port.js';
import { ApiTextGenerationService } from './api-text-generation.service.js';
import { normalizeFlashcardLibraryImage } from './flashcard-library-transport-image.js';
import {
  FLASHCARD_IMAGE_QUALIFICATION_PROMPT,
  FlashcardLibraryTransport,
  flashcardImageQualificationScope,
} from './flashcard-library-transport.service.js';

const selection: TeacherSelection = {
  connection_id: '3',
  mode: 'api_key',
  model_id: 'synthetic-catalog-choice',
  effort_id: null,
};
const configuration: NodiaAiApiConfiguration = {
  providerKey: 'openai',
  connectionId: selection.connection_id,
  keyId: '7',
  resourceKey: 'fixture-resource',
  sessionGeneration: 'fixture-epoch',
  configurationGeneration: 'fixture-configuration',
};
const policy = {
  budget: { provider_dispatches_per_run: 1 },
  results: {
    assembled_context_utf8_bytes: 40000,
    assistant_text_utf8_bytes: 32000,
    provider_stream_bytes: 64000,
  },
} as NodiaAiRuntimePolicy;

function fixture(qualified = false) {
  const query = vi.fn(async () =>
    qualified ? [{ operation_id: 'fixture-image-qualification' }] : [],
  );
  const manager = { query } as unknown as EntityManager;
  const source = { manager } as DataSource;
  const credentialBoundary = {
    configuration: vi.fn(async () => configuration),
    secret: vi.fn(async () => 'fixture-key'),
  };
  const credentials =
    credentialBoundary as unknown as ApiNodiaAiCredentialsService;
  const transport = new FlashcardLibraryTransport(
    source,
    credentials,
    new ApiTextGenerationService(credentials, policy),
    policy,
  );
  const context: AiGenerationExecutionContext = {
    operationId: '12345678-1234-4234-8123-123456789012',
    selection,
    prompt: 'Illustrate an exercise from a study note.',
    deadlineAt: new Date('2100-01-01T00:00:00Z'),
    resourceKey: configuration.resourceKey,
    configurationGeneration: configuration.configurationGeneration,
    sessionGeneration: configuration.sessionGeneration,
    beforeExchange: vi.fn(async () => undefined),
    checkLease: vi.fn(async () => undefined),
  };
  return { transport, manager, query, credentialBoundary, context };
}

const signal = () => new AbortController().signal;
const hash = (bytes: Buffer) =>
  createHash('sha256').update(bytes).digest('hex');

async function imageFixture(width = 640, height = 100) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'blue';
  ctx.fillRect(10, 10, 130, 45);
  const bytes = await canvas.encode('png');
  return {
    mediaType: 'image/png' as const,
    contentBase64: bytes.toString('base64'),
    sha256: hash(bytes),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('flashcard library provider transport', () => {
  it('requires exact Teacher image evidence without touching the provider or key', async () => {
    const { transport, query, credentialBoundary, context } = fixture();
    await expect(transport.configure(selection, 'text')).resolves.toEqual(
      configuration,
    );
    expect(query).not.toHaveBeenCalled();
    await expect(transport.configure(selection, 'image')).rejects.toThrow(
      'flashcard_image_unqualified',
    );
    await expect(transport.execute('image', context, signal())).rejects.toThrow(
      'flashcard_image_unqualified',
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('teacher_flashcard_image_qualifications'),
      [
        flashcardImageQualificationScope(selection, configuration),
        'teacher-flashcard-library-image/1',
      ],
    );
    expect(credentialBoundary.secret).not.toHaveBeenCalled();
    expect(context.beforeExchange).not.toHaveBeenCalled();
    expect(
      flashcardImageQualificationScope(selection, {
        ...configuration,
        sessionGeneration: 'new-key-epoch',
      }),
    ).not.toEqual(flashcardImageQualificationScope(selection, configuration));
  });

  it('rejects obsolete epochs, unsupported modes and any arbitrary prompt on the operator lane', async () => {
    const { transport, credentialBoundary, context } = fixture(true);
    await expect(
      transport.execute(
        'image',
        { ...context, sessionGeneration: 'old-epoch' },
        signal(),
      ),
    ).rejects.toThrow('configuration_changed');
    await expect(
      transport.configure({ ...selection, mode: 'agentic' }, 'image'),
    ).rejects.toThrow('flashcard_library_mode_unsupported');
    await expect(
      transport.execute('image', context, signal(), true),
    ).rejects.toThrow('flashcard_image_qualification_invalid');
    expect(credentialBoundary.secret).not.toHaveBeenCalled();
    expect(context.beforeExchange).not.toHaveBeenCalled();
  });

  it('reserves one exchange before sending without tools and returns a bounded still WebP', async () => {
    const { transport, context } = fixture(true);
    const png = await imageFixture(1200, 700);
    const fetcher = vi.fn(async () => {
      expect(context.beforeExchange).toHaveBeenCalledOnce();
      return new Response(
        JSON.stringify({ data: [{ b64_json: png.contentBase64 }] }),
      );
    });
    vi.stubGlobal('fetch', fetcher);
    const result = await transport.execute('image', context, signal());
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(
      'https://api.openai.com/v1/images/generations',
      expect.objectContaining({
        method: 'POST',
        redirect: 'error',
        body: JSON.stringify({
          model: selection.model_id,
          prompt: context.prompt,
          n: 1,
        }),
      }),
    );
    expect(result.image).toBeDefined();
    if (!result.image) return;
    expect(result.image.mime).toBe('image/webp');
    expect(result.image.bytes.length).toBeLessThanOrEqual(
      FLASHCARD_IMAGE_MAX_BYTES,
    );
    expect(imageSize(result.image.bytes)).toMatchObject({
      type: 'webp',
      width: 960,
      height: 560,
    });
    expect(result.responseHash).toBe(hash(result.image.bytes));
  });

  it('keeps the operator prompt fixed and rejects a response giving a URL instead of pixels', async () => {
    const { transport, context } = fixture();
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ data: [{ url: 'https://fixture.invalid/image' }] }),
        ),
    );
    vi.stubGlobal('fetch', fetcher);
    await expect(
      transport.execute(
        'image',
        { ...context, prompt: FLASHCARD_IMAGE_QUALIFICATION_PROMPT },
        signal(),
        true,
      ),
    ).rejects.toMatchObject({ code: 'api_image_invalid' });
    expect(context.beforeExchange).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledOnce();
  });
});

describe('private proposal image normalization', () => {
  it('rejects mismatched MIME, incorrect digests and invalid or oversized pixels', async () => {
    const png = await imageFixture();
    const invalid = Buffer.from('unusable payload');
    for (const image of [
      { ...png, mediaType: 'image/jpeg' as const },
      { ...png, sha256: '0'.repeat(64) },
      {
        ...png,
        contentBase64: invalid.toString('base64'),
        sha256: hash(invalid),
      },
      await imageFixture(4097, 4),
    ]) {
      await expect(
        normalizeFlashcardLibraryImage(image, signal()),
      ).rejects.toThrow('flashcard_image_output_invalid');
    }
  });
});
