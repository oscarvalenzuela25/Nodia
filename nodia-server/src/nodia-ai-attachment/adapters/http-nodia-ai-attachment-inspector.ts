import {
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { openAsBlob } from 'node:fs';
import { lstat } from 'node:fs/promises';
import { envs } from '../../config/envs.config.js';
import {
  NodiaAiAttachmentInspector,
  type NodiaAiAttachmentKind,
} from '../types/attachment-ports.js';

/** Private bounded decoder; the microservice never receives a host path or URL. */
@Injectable()
export class HttpNodiaAiAttachmentInspector extends NodiaAiAttachmentInspector {
  async inspect(input: {
    path: string;
    kind: NodiaAiAttachmentKind;
    byteCount: number;
    signal?: AbortSignal;
  }) {
    if (
      !envs.GEMINI_MICROSERVICE_URL ||
      !/^[0-9a-fA-F]{64}$/.test(envs.GEMINI_SERVICE_TOKEN)
    ) {
      throw new ServiceUnavailableException(
        'nodia_ai:attachment_parser_unavailable',
      );
    }
    const info = await lstat(input.path);
    if (
      !info.isFile() ||
      info.isSymbolicLink() ||
      info.size !== input.byteCount ||
      !Number.isSafeInteger(input.byteCount) ||
      input.byteCount < 1 ||
      input.byteCount > 20 * 1024 * 1024
    ) {
      throw new UnprocessableEntityException('nodia_ai:attachment_invalid');
    }
    const signal = input.signal
      ? AbortSignal.any([input.signal, AbortSignal.timeout(80000)])
      : AbortSignal.timeout(80000);
    let response: Response;
    try {
      response = await fetch(
        new URL('/attachments/inspect', envs.GEMINI_MICROSERVICE_URL),
        {
          method: 'POST',
          redirect: 'error',
          signal,
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': String(input.byteCount),
            'X-Nodia-Service-Token': envs.GEMINI_SERVICE_TOKEN,
            'X-Nodia-Attachment-Kind': input.kind,
          },
          body: await openAsBlob(input.path, {
            type: 'application/octet-stream',
          }),
        },
      );
    } catch {
      throw new ServiceUnavailableException(
        'nodia_ai:attachment_parser_unavailable',
      );
    }
    const reader = response.body?.getReader();
    if (!reader)
      throw new ServiceUnavailableException(
        'nodia_ai:attachment_parser_unavailable',
      );
    try {
      const chunks: Uint8Array[] = [];
      let count = 0;
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        count += chunk.value.byteLength;
        if (count > 200000) throw new Error('Invalid inspector response');
        chunks.push(chunk.value);
      }
      if (!response.ok) {
        if ([413, 415, 422].includes(response.status))
          throw new UnprocessableEntityException('nodia_ai:attachment_invalid');
        throw new ServiceUnavailableException(
          'nodia_ai:attachment_parser_unavailable',
        );
      }
      const value: unknown = JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)),
      );
      if (typeof value !== 'object' || value === null || Array.isArray(value))
        throw new Error('Invalid inspector response');
      const row = value as Record<string, unknown>;
      const types = {
        image: ['image/png', 'image/jpeg', 'image/webp'],
        pdf: ['application/pdf'],
        audio: [
          'audio/wav',
          'audio/ogg',
          'audio/webm',
          'audio/mpeg',
          'audio/mp4',
        ],
      };
      if (
        Object.keys(row).length !== 4 ||
        typeof row.media_type !== 'string' ||
        !types[input.kind].includes(row.media_type) ||
        (input.kind === 'pdf'
          ? !Number.isInteger(row.page_count) ||
            Number(row.page_count) < 1 ||
            Number(row.page_count) > 100
          : row.page_count !== null) ||
        (input.kind === 'audio'
          ? typeof row.duration_seconds !== 'number' ||
            !Number.isFinite(row.duration_seconds) ||
            row.duration_seconds <= 0 ||
            row.duration_seconds > 300
          : row.duration_seconds !== null) ||
        !(
          row.extracted_text === null ||
          (input.kind === 'pdf' &&
            typeof row.extracted_text === 'string' &&
            row.extracted_text.trim().length > 0 &&
            Buffer.byteLength(row.extracted_text, 'utf8') <= 32768)
        )
      )
        throw new Error('Invalid inspector metadata');
      return {
        mediaType: row.media_type,
        pageCount: row.page_count as number | null,
        durationSeconds: row.duration_seconds as number | null,
        extractedText: row.extracted_text as string | null,
      };
    } catch (error) {
      if (
        error instanceof UnprocessableEntityException ||
        error instanceof ServiceUnavailableException
      )
        throw error;
      throw new ServiceUnavailableException(
        'nodia_ai:attachment_parser_unavailable',
      );
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  }
}
