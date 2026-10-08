import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { observedModels } from '../../ai-provider/helpers/model-observation.helper.js';
import {
  API_INVOICE_SCHEMA,
  invoicePrompt,
  parseApiInvoice,
} from './api-invoice-contract.js';

export type ApiThinkingLevel = 'low' | 'medium' | 'high';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadGatewayException('Respuesta API inválida.');
  return value as Record<string, unknown>;
}

@Injectable()
export class ApiProviderService {
  private async request(
    url: string,
    secret: string,
    google: boolean,
    body?: unknown,
    deadline?: AbortSignal,
  ) {
    const timeout = AbortSignal.timeout(body === undefined ? 15000 : 90000);
    const signal = deadline ? AbortSignal.any([timeout, deadline]) : timeout;
    try {
      const response = await fetch(url, {
        method: body === undefined ? 'GET' : 'POST',
        signal,
        redirect: 'error',
        headers: {
          'Content-Type': 'application/json',
          ...(google
            ? { 'x-goog-api-key': secret }
            : { Authorization: `Bearer ${secret}` }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!response.ok) {
        await response.body?.cancel();
        // Never forward raw upstream errors: providers can echo secrets, documents or request bodies.
        throw new HttpException(
          {
            message: `La API del proveedor rechazó la solicitud (HTTP ${response.status}).`,
            code: 'AI_API_REJECTED',
            upstream_status: response.status,
          },
          response.status === 429 ? 429 : 502,
        );
      }
      const reader = response.body?.getReader();
      if (!reader) throw new BadGatewayException('Respuesta API vacía.');
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.byteLength;
          if (size > 2 * 1024 * 1024)
            throw new BadGatewayException(
              'La respuesta API excede el límite permitido.',
            );
          chunks.push(part.value);
        }
      } finally {
        await reader.cancel();
      }
      const raw = Buffer.concat(chunks).toString('utf8');
      let result: unknown;
      try {
        result = JSON.parse(raw);
      } catch {
        throw new BadGatewayException('La API devolvió JSON inválido.');
      }
      return object(result);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadGatewayException(
        signal.aborted
          ? 'La API del proveedor agotó el tiempo de espera.'
          : 'No se pudo conectar con la API del proveedor.',
      );
    }
  }

  async listModels(key: string, secret: string) {
    if (key === 'openai') {
      const response = await this.request(
        'https://api.openai.com/v1/models',
        secret,
        false,
      );
      if (!Array.isArray(response.data) || response.data.length > 10000)
        throw new BadGatewayException('Catálogo OpenAI inválido.');
      return observedModels(
        response.data.map((value: unknown) => {
          const model = object(value);
          return { id: model.id, name: model.id }; // This endpoint does not report modality/context/quota.
        }),
      );
    }
    if (key !== 'gemini')
      throw new BadRequestException(
        'Este proveedor no tiene un adaptador API implementado.',
      );
    const entries: Record<string, unknown>[] = [];
    let token = '';
    const seen = new Set<string>();
    for (let page = 0; page < 20; page++) {
      const params = new URLSearchParams({
        pageSize: '1000',
        ...(token ? { pageToken: token } : {}),
      });
      const response = await this.request(
        `https://generativelanguage.googleapis.com/v1beta/models?${params}`,
        secret,
        true,
      );
      if (!Array.isArray(response.models))
        throw new BadGatewayException('Catálogo Gemini API inválido.');
      for (const raw of response.models) {
        const model = object(raw);
        if (typeof model.name !== 'string')
          throw new BadGatewayException('Modelo Gemini API inválido.');
        if (
          Array.isArray(model.supportedGenerationMethods) &&
          model.supportedGenerationMethods.includes('generateContent')
        ) {
          entries.push({
            id: model.name.replace(/^models\//, ''),
            name: model.displayName ?? model.name,
            description: model.description,
            contextWindow: model.inputTokenLimit,
          });
        }
      }
      if (response.nextPageToken === undefined || response.nextPageToken === '')
        return observedModels(entries);
      if (
        typeof response.nextPageToken !== 'string' ||
        seen.has(response.nextPageToken)
      )
        throw new BadGatewayException('Paginación API inválida.');
      token = response.nextPageToken;
      seen.add(token);
    }
    throw new BadGatewayException(
      'El catálogo API excede el límite de páginas.',
    );
  }

  async extractInvoice(
    key: string,
    secret: string,
    model: string,
    buffer: Buffer,
    mime: string,
    fields?: Record<string, unknown>,
    tax = 19,
    deadline?: AbortSignal,
    thinkingLevel?: ApiThinkingLevel,
  ) {
    if (!model.trim())
      throw new BadRequestException('Sin modelo asignado para API.');
    const data = buffer.toString('base64');
    const prompt = invoicePrompt(fields, tax);
    if (key === 'openai') {
      const attachment =
        mime === 'application/pdf'
          ? {
              type: 'input_file',
              filename: 'invoice.pdf',
              file_data: `data:${mime};base64,${data}`,
            }
          : { type: 'input_image', image_url: `data:${mime};base64,${data}` };
      const response = await this.request(
        'https://api.openai.com/v1/responses',
        secret,
        false,
        {
          model,
          store: false,
          ...(thinkingLevel ? { reasoning: { effort: thinkingLevel } } : {}),
          input: [
            {
              role: 'user',
              content: [{ type: 'input_text', text: prompt }, attachment],
            },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'invoice',
              strict: true,
              schema: API_INVOICE_SCHEMA,
            },
          },
        },
        deadline,
      );
      if (response.status !== 'completed' || !Array.isArray(response.output))
        throw new BadGatewayException('La API no completó la extracción.');
      const texts: string[] = [];
      for (const raw of response.output) {
        const output = object(raw);
        if (output.type !== 'message' || !Array.isArray(output.content))
          continue;
        for (const rawPart of output.content) {
          const part = object(rawPart);
          if (part.type === 'refusal')
            throw new BadGatewayException(
              'La API rechazó el análisis del documento.',
            );
          if (part.type === 'output_text' && typeof part.text === 'string')
            texts.push(part.text);
        }
      }
      return parseApiInvoice(texts.join(''));
    }
    if (key !== 'gemini')
      throw new BadRequestException(
        'Este proveedor no tiene un adaptador API implementado.',
      );
    const response = await this.request(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model.replace(/^models\//, ''))}:generateContent`,
      secret,
      true,
      {
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }, { inlineData: { mimeType: mime, data } }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: API_INVOICE_SCHEMA,
          ...(thinkingLevel ? { thinkingConfig: { thinkingLevel: thinkingLevel.toUpperCase() } } : {}),
        },
      },
      deadline,
    );
    if (!Array.isArray(response.candidates) || response.candidates.length !== 1)
      throw new BadGatewayException('La API no completó la extracción.');
    const candidate = object(response.candidates[0]);
    if (candidate.finishReason !== 'STOP')
      throw new BadGatewayException('La API no completó la extracción.');
    const content = object(candidate.content);
    if (!Array.isArray(content.parts))
      throw new BadGatewayException('Respuesta API inválida.');
    return parseApiInvoice(
      content.parts
        .map((raw: unknown) => object(raw).text)
        .filter((text): text is string => typeof text === 'string')
        .join(''),
    );
  }
}
