import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiProviderService } from './api-provider.service.js';
import { API_INVOICE_SCHEMA, parseApiInvoice } from './api-invoice-contract.js';

afterEach(() => vi.unstubAllGlobals());

describe('Gemini native REST invoice contract', () => {
  it('uses the native JSON response format envelope and preserves the explicit model and PDF', async () => {
    const invoice = {
      code: null,
      total_amount: 0,
      issue_date: null,
      items: [],
    };
    const fetchMock = vi.fn().mockResolvedValue(
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
    vi.stubGlobal('fetch', fetchMock);
    const document = Buffer.from('%PDF-1.4 synthetic fixture');
    const result = await new ApiProviderService().extractInvoice(
      'gemini',
      'synthetic-key',
      'discovered-account-model',
      document,
      'application/pdf',
    );
    expect(result.total_amount).toBe(0);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/discovered-account-model:generateContent',
    );
    const body = JSON.parse(request.body);
    expect(body.generationConfig.responseFormat.text.mimeType).toBe(
      'APPLICATION_JSON',
    );
    const schema = body.generationConfig.responseFormat.text.schema;
    expect(schema.properties.items).not.toHaveProperty('maxItems');
    expect(schema.properties.items.items).toEqual(
      API_INVOICE_SCHEMA.properties.items.items,
    );
    expect(API_INVOICE_SCHEMA.properties.items.maxItems).toBe(1000);
    expect(body.generationConfig).not.toHaveProperty('responseMimeType');
    expect(body.generationConfig).not.toHaveProperty('responseJsonSchema');
    expect(body.contents[0].parts[1].inlineData).toEqual({
      mimeType: 'application/pdf',
      data: document.toString('base64'),
    });
    expect(request.headers['x-goog-api-key']).toBe('synthetic-key');
  });

  it('rejects an extraction above the application item limit even without a provider grammar bound', () => {
    const item = {
      code: null,
      name: 'Synthetic item',
      quantity: 0,
      cost_price: null,
      cost_price_tax: null,
      unit_price: 0,
      total_price: 0,
      packages: null,
      units_per_package: null,
    };
    const invoice = {
      code: null,
      total_amount: 0,
      issue_date: null,
      items: Array.from({ length: 1000 }, () => item),
    };
    expect(parseApiInvoice(JSON.stringify(invoice)).items).toHaveLength(1000);
    expect(() =>
      parseApiInvoice(
        JSON.stringify({ ...invoice, items: [...invoice.items, item] }),
      ),
    ).toThrow();
  });
});
