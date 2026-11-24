import { HttpException, type HttpStatus } from '@nestjs/common';
import { NodiaAiAdapterError } from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';

export function cvGenerationError(
  code: string,
  status: HttpStatus = 409,
): never {
  throw new HttpException(`nodiaCv:${code}`, status);
}

export function cvGenerationFailure(error: unknown): string | null {
  if (error instanceof NodiaAiAdapterError) {
    if (
      [
        'api_configuration_unavailable',
        'api_model_unavailable',
        'api_credential_unavailable',
        'adapter_invalid_selection',
        'adapter_configuration_changed',
      ].includes(error.code)
    )
      return 'selection_unavailable';
    if (/rate_limit|quota/.test(error.code)) return 'provider_rate_limited';
    return 'provider_unavailable';
  }
  if (error instanceof HttpException) {
    const status = error.getStatus();
    if (status === 401 || status === 403) return 'authority_changed';
    const result = error.getResponse();
    const message =
      typeof result === 'string'
        ? result
        : 'message' in result
          ? result.message
          : null;
    if (typeof message === 'string' && /^nodiaCv:[a-z_]{1,64}$/.test(message))
      return message.slice('nodiaCv:'.length);
  }
  return null;
}
