import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { json, type RequestHandler } from 'express';
import { parseNodiaAiStrictJson } from '../nodia-ai-context/strict-json.js';

function verifyProposalJson(value: unknown): void {
  const unicode = (text: string) => {
    if (
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(
        text,
      )
    )
      throw new BadRequestException('nodia_ai:invalid_input');
  };
  if (typeof value === 'string') unicode(value);
  else if (typeof value === 'number' && !Number.isFinite(value))
    throw new BadRequestException('nodia_ai:invalid_input');
  else if (Array.isArray(value)) value.forEach(verifyProposalJson);
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      unicode(key);
      verifyProposalJson(child);
    }
  }
}

/** Policy is injected from the packaged release, never copied as a transport default. */
export function createNodiaAiConversationBodyParser(
  maxBytes: number,
): RequestHandler {
  const parse = json({
    limit: maxBytes,
    inflate: false,
    strict: true,
    verify: (request, _response, buffer, encoding) => {
      // Mounted middleware sees a relative URL; standalone integration can see
      // the original path. Existing conversation consumers keep their contract.
      const path = (request.url ?? '').split('?')[0];
      if (!/^(?:\/api\/v1\/nodia-ai)?\/proposals(?:\/|$)/iu.test(path)) return;
      if (encoding !== 'utf-8' && encoding !== 'utf8')
        throw new BadRequestException('nodia_ai:invalid_input');
      const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      verifyProposalJson(parseNodiaAiStrictJson(text));
    },
  });
  return (request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Request-Id', randomUUID());
    parse(request, response, (error?: unknown) => {
      const type =
        error && typeof error === 'object' && 'type' in error
          ? error.type
          : null;
      if (type === 'entity.too.large')
        return next(new PayloadTooLargeException('nodia_ai:invalid_input'));
      if (
        type === 'entity.parse.failed' ||
        type === 'entity.verify.failed' ||
        type === 'encoding.unsupported'
      )
        return next(new BadRequestException('nodia_ai:invalid_input'));
      next(error);
    });
  };
}
