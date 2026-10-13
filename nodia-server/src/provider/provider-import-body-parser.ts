import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { json, type RequestHandler } from 'express';
const parse = json({ limit: '4mb' });
export const providerImportBodyParser: RequestHandler = (
  request,
  response,
  next,
) => {
  parse(request, response, (error?: unknown) => {
    const type =
      error && typeof error === 'object' && 'type' in error
        ? error.type
        : undefined;
    if (type === 'entity.too.large')
      return next(
        new PayloadTooLargeException('Provider import exceeds 4 MiB'),
      );
    if (type === 'entity.parse.failed')
      return next(new BadRequestException('Invalid provider import JSON'));
    next(error);
  });
};
