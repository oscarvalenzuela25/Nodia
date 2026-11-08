import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalyzeInvoiceUseCase } from './analyze-invoice.use-case.js';
import { GeminiService } from '../../common/ai/gemini.service.js';
import type { MistralService } from '../../common/ai/mistral.service.js';
import type { ProviderService } from '../../provider/provider.service.js';
import type { AiProviderService } from '../../ai-provider/ai-provider.service.js';
import { envs } from '../../config/envs.config.js';
import type { InvoiceService } from '../invoice.service.js';

const actor = {
  userId: '12',
  sessionId: '11111111-1111-4111-8111-111111111112',
};
const invoiceAccess = { assertBusinessAccess: vi.fn(async () => undefined) };

const original = { ...envs };
afterEach(() => {
  Object.assign(envs, original);
  vi.unstubAllGlobals();
});

describe('Gemini draft extraction without attachment storage', () => {
  it('uses the private HTTP adapter without R2 and leaves persistence to confirmation', async () => {
    Object.assign(envs, {
      GEMINI_MICROSERVICE_URL: 'http://127.0.0.1:8000',
      GEMINI_SERVICE_TOKEN: 'ab'.repeat(32),
      R2_ACCOUNT_ID: '',
      R2_ACCESS_KEY_ID: '',
      R2_SECRET_ACCESS_KEY: '',
      R2_BUCKET_NAME: '',
    });
    const fetch = vi.fn(async (_url, options: RequestInit) => {
      expect((options.body as FormData).get('thinking_level')).toBe('medium');
      expect((options.body as FormData).has('extended_thinking')).toBe(false);
      return new Response(
        JSON.stringify({
          code: 'SYNTHETIC',
          total_amount: 0,
          data: { items: [{ name: 'Synthetic', quantity: 0 }] },
        }),
      );
    });
    vi.stubGlobal('fetch', fetch);
    const providers = {
      findProviderById: vi.fn(async () => ({
        id: '42',
        is_active: true,
        key: 'gemini',
        use_agentic: true,
        catalog: { key: 'gemini', can_use_agentic: true },
        default_mode: 'agentic',
        fields: {
          agentic: {
            selected_model: 'observed-model',
            thinking_level: 'medium',
          },
        },
      })),
    };
    const useCase = new AnalyzeInvoiceUseCase(
      new GeminiService(),
      {} as MistralService,
      {} as ProviderService,
      providers as unknown as AiProviderService,
      undefined,
      undefined,
      invoiceAccess as unknown as InvoiceService,
    );
    const file = {
      buffer: Buffer.from('%PDF-1.4'),
      size: 8,
      mimetype: 'application/pdf',
    } as Express.Multer.File;
    const result = await useCase.execute(
      file,
      {
        business_id: 'synthetic-business',
        ai_provider_id: '42',
        mode: 'agentic',
      },
      undefined,
      undefined,
      actor,
    );
    expect(result).toMatchObject({ code: 'SYNTHETIC', total_amount: 0 });
    expect(result.path_storage).toBeUndefined();
    expect(fetch).toHaveBeenCalledOnce();
    envs.GEMINI_SERVICE_TOKEN = '';
    await expect(
      useCase.execute(
        file,
        {
          business_id: 'synthetic-business',
          ai_provider_id: '42',
          mode: 'agentic',
        },
        undefined,
        undefined,
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(fetch).toHaveBeenCalledOnce();
  });
});
