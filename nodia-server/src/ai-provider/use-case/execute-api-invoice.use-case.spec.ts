import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpException } from '@nestjs/common';
import { ExecuteApiInvoiceUseCase } from './execute-api-invoice.use-case.js';
import { ApiProviderService } from '../../common/ai/api-provider.service.js';
import type { AiProviderService } from '../ai-provider.service.js';

const file = {
  buffer: Buffer.from('%PDF-1.4\nsynthetic fixture'),
  mimetype: 'application/pdf',
  size: 26,
} as Express.Multer.File;
const invoice = {
  code: null,
  total_amount: 0,
  issue_date: null,
  items: [
    {
      code: null,
      name: 'Synthetic item',
      quantity: null,
      cost_price: null,
      cost_price_tax: null,
      unit_price: 0,
      total_price: null,
      packages: null,
      units_per_package: null,
    },
  ],
};
function setup(rotate = false) {
  const provider = {
    id: '42',
    is_active: true,
    use_api_key: true,
    auto_rotate_api_keys: rotate,
    catalog: { key: 'openai', can_use_api_key: true, is_active: true },
    fields: {
      api_key: {
        selected_model: 'account-model',
        available_models: [{ id: 'account-model' }],
      },
    },
  };
  const providers = {
    findProviderById: vi.fn().mockResolvedValue(provider),
    getEligibleApiKeySecrets: vi.fn().mockResolvedValue(['synthetic-key']),
  };
  const api = new ApiProviderService();
  return {
    provider,
    providers,
    api,
    useCase: new ExecuteApiInvoiceUseCase(
      providers as unknown as AiProviderService,
      api,
    ),
  };
}
const respond = (text = JSON.stringify(invoice)) =>
  new Response(
    JSON.stringify({
      status: 'completed',
      output: [{ type: 'message', content: [{ type: 'output_text', text }] }],
    }),
    { status: 200 },
  );
afterEach(() => vi.unstubAllGlobals());

describe('API invoice execution through the real adapter', () => {
  it('sends Gemini API the configured model and document independently from Web sessions', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason: 'STOP',
                content: { parts: [{ text: JSON.stringify(invoice) }] },
              },
            ],
          }),
        ),
      );
    vi.stubGlobal('fetch', fetch);
    const { provider, useCase } = setup();
    provider.catalog.key = 'gemini';
    expect((await useCase.execute('42', undefined, file)).total_amount).toBe(0);
    const [url, request] = fetch.mock.calls[0];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/account-model:generateContent',
    );
    expect(request.headers['x-goog-api-key']).toBe('synthetic-key');
    expect(JSON.parse(request.body).contents[0].parts[1].inlineData).toEqual({
      mimeType: 'application/pdf',
      data: file.buffer.toString('base64'),
    });
  });
  it('uses the exact model/key/PDF and preserves missing values and real zero without storing responses', async () => {
    const fetch = vi.fn().mockResolvedValue(respond());
    vi.stubGlobal('fetch', fetch);
    const { useCase } = setup();
    const result = await useCase.execute('42', undefined, file);
    expect(result.total_amount).toBe(0);
    expect(result.items[0].quantity).toBeNull();
    expect(result.items[0].unit_price).toBe(0);
    const [url, request] = fetch.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(request.headers.Authorization).toBe('Bearer synthetic-key');
    const body = JSON.parse(request.body);
    expect(body).toMatchObject({ model: 'account-model', store: false });
    expect(body.input[0].content[1]).toMatchObject({
      type: 'input_file',
      filename: 'invoice.pdf',
    });
  });
  it('rejects another model/missing model/disabled channel before any paid call', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const { useCase, provider } = setup();
    await expect(useCase.execute('42', 'other-model', file)).rejects.toThrow(
      'no está configurado',
    );
    provider.fields.api_key.selected_model = '';
    await expect(useCase.execute('42', undefined, file)).rejects.toThrow(
      'Sin modelo',
    );
    provider.use_api_key = false;
    await expect(useCase.execute('42', 'account-model', file)).rejects.toThrow(
      'no está habilitado',
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(['low', 'medium', 'high'] as const)('sends the saved per-model API level %s to OpenAI and Gemini exactly', async (level) => {
    const fetch = vi.fn().mockResolvedValueOnce(respond()).mockResolvedValueOnce(new Response(JSON.stringify({
      candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(invoice) }] } }],
    })));
    vi.stubGlobal('fetch', fetch);
    const { provider, useCase } = setup();
    Object.assign(provider.fields.api_key, { thinking_levels: { 'account-model': level }, thinking_level: 'high' });
    await useCase.execute('42', undefined, file);
    expect(JSON.parse(fetch.mock.calls[0][1].body).reasoning).toEqual({ effort: level });
    provider.catalog.key = 'gemini';
    await useCase.execute('42', undefined, file);
    const body = JSON.parse(fetch.mock.calls[1][1].body);
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: level.toUpperCase() });
    expect(body.generationConfig).not.toHaveProperty('thinkingBudget');
  });
  it('prioritizes an explicit level and resolves general and historical API preferences without inheriting session modes', async () => {
    const fetch = vi.fn().mockImplementation(async () => respond());
    vi.stubGlobal('fetch', fetch);
    const { provider, useCase } = setup();
    Object.assign(provider.fields.api_key, { thinking_levels: { 'account-model': 'high' }, thinking_level: 'medium' });
    await useCase.execute('42', undefined, file, undefined, 19, 'low');
    expect(JSON.parse(fetch.mock.calls[0][1].body).reasoning).toEqual({ effort: 'low' });
    Object.assign(provider.fields.api_key, { thinking_levels: {} });
    await useCase.execute('42', undefined, file);
    expect(JSON.parse(fetch.mock.calls[1][1].body).reasoning).toEqual({ effort: 'medium' });
    Object.assign(provider.fields.api_key, { thinking_level: undefined });
    Object.assign(provider.fields, { thinking_level: 'high', token_plan_agentic: { thinking_level: 'high' } });
    await useCase.execute('42', undefined, file);
    expect(JSON.parse(fetch.mock.calls[2][1].body)).not.toHaveProperty('reasoning');
    Object.assign(provider, { fields: { selected_model: 'account-model', available_models: [{ id: 'account-model' }], thinking_level: 'low' } });
    await useCase.execute('42', undefined, file);
    expect(JSON.parse(fetch.mock.calls[3][1].body).reasoning).toEqual({ effort: 'low' });
  });
  it.each(['max', false, {}, ''])('rejects invalid persisted API reasoning %j before reading secrets or calling the provider', async (level) => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const { provider, providers, useCase } = setup();
    Object.assign(provider.fields.api_key, { thinking_levels: { 'account-model': level } });
    await expect(useCase.execute('42', undefined, file)).rejects.toThrow('nivel de razonamiento API');
    expect(providers.getEligibleApiKeySecrets).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not retry or drop the selected level when the API rejects an unsupported option', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('private error', { status: 400 }));
    vi.stubGlobal('fetch', fetch);
    const { provider, providers, useCase } = setup(true);
    Object.assign(provider.fields.api_key, { thinking_level: 'medium' });
    providers.getEligibleApiKeySecrets.mockResolvedValue(['synthetic-one', 'synthetic-two']);
    await expect(useCase.execute('42', undefined, file)).rejects.toThrow('HTTP 400');
    expect(fetch).toHaveBeenCalledOnce();
    expect(JSON.parse(fetch.mock.calls[0][1].body).reasoning).toEqual({ effort: 'medium' });
  });
  it('rejects invalid output and provider refusal without guessing invoice data', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(respond('not JSON'))
      .mockResolvedValueOnce(
        respond(JSON.stringify({ ...invoice, total_amount: -1 })),
      );
    vi.stubGlobal('fetch', fetch);
    const { useCase } = setup();
    await expect(useCase.execute('42', undefined, file)).rejects.toThrow(
      'inválida',
    );
    await expect(useCase.execute('42', undefined, file)).rejects.toThrow(
      'inválida',
    );
    fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 'completed',
          output: [
            {
              type: 'message',
              content: [{ type: 'refusal', refusal: 'Synthetic refusal' }],
            },
          ],
        }),
      ),
    );
    await expect(useCase.execute('42', undefined, file)).rejects.toThrow(
      'rechazó el análisis',
    );
  });
  it('rotates only after a credential/quota rejection and never retries an uncertain result', async () => {
    const { useCase, providers, api } = setup(true);
    providers.getEligibleApiKeySecrets.mockResolvedValue([
      'synthetic-one',
      'synthetic-two',
    ]);
    const extract = vi
      .spyOn(api, 'extractInvoice')
      .mockRejectedValueOnce(
        new HttpException({ upstream_status: 429, message: 'quota' }, 429),
      )
      .mockResolvedValueOnce({ code: '', total_amount: null, items: [] });
    await useCase.execute('42', undefined, file);
    expect(extract.mock.calls.map((call) => call[1])).toEqual([
      'synthetic-one',
      'synthetic-two',
    ]);
    expect(extract.mock.calls[0][7]).toBe(extract.mock.calls[1][7]);
    extract.mockClear().mockRejectedValue(new Error('uncertain timeout'));
    await expect(useCase.execute('42', undefined, file)).rejects.toThrow(
      'uncertain timeout',
    );
    expect(extract).toHaveBeenCalledOnce();
  });
  it('sanitizes upstream rejection and network errors instead of exposing raw secrets', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('synthetic-secret should never reach user', {
          status: 401,
        }),
      )
      .mockRejectedValueOnce(new Error('synthetic-secret'));
    vi.stubGlobal('fetch', fetch);
    const { useCase } = setup();
    await expect(useCase.execute('42', undefined, file)).rejects.toThrow(
      'HTTP 401',
    );
    await expect(useCase.execute('42', undefined, file)).rejects.toThrow(
      'No se pudo conectar',
    );
  });
});
