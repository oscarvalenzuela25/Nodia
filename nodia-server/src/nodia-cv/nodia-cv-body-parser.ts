import { json, type RequestHandler } from 'express';
import { TextDecoder } from 'node:util';

export const NODIA_CV_HTTP_PATH = '/api/v1/nodia-cv';

const parseJson = json({
  limit: 128 * 1024,
  strict: true,
  verify: (_request, _response, bytes) => {
    // Reject invalid UTF-8 instead of persisting replacement characters.
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  },
});

export const nodiaCvBodyParser: RequestHandler = function nodiaCvBodyParser(
  request,
  response,
  next,
) {
  response.setHeader('Cache-Control', 'private, no-store');
  parseJson(request, response, next);
};
