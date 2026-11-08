import { json, type RequestHandler } from 'express';
import { TextDecoder } from 'node:util';
/** Must be installed before Nest's generic JSON parser. */
const parseTeacherJson = json({
  limit: 256 * 1024,
  strict: true,
  verify: (_request, _response, buffer) => {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      const error = new Error('teacher:invalid_input') as Error & {
        status: number;
        type: string;
      };
      error.status = 400;
      error.type = 'entity.verify.failed';
      throw error;
    }
  },
});

// Nest detects an already-installed global JSON parser by middleware.name.
// Keep the scoped parser behind its own name so unrelated routes retain Nest's
// generic JSON parser when this middleware is mounted before app.init().
export const teacherBodyParser: RequestHandler = function teacherBodyParser(
  request,
  response,
  next,
) {
  parseTeacherJson(request, response, next);
};
