import { HttpException, Logger, type HttpStatus } from '@nestjs/common';
import type { AiSelection } from '../../ai-generation/ai-selection.js';
import type { NodiaAiApiProvider } from '../../nodia-ai-adapter/api-nodia-ai-credentials.service.js';
import { NodiaAiAdapterError } from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';

const logger = new Logger('NodiaCvGenerationWorker');
const outputRejectionReasons = new Set([
  'invalid_model_output',
  'invalid_citation',
  'invalid_evidence',
  'draft_size_limit',
  'qualification_draft_mismatch',
]);

/** Only record diagnostics produced by CV validation, without any response text. */
export function reportCvOutputRejection(
  claim: {
    row: { id: string };
    configuration: { providerKey: NodiaAiApiProvider };
    selection: { mode: AiSelection['mode'] };
  },
  reason: string,
) {
  if (!outputRejectionReasons.has(reason)) return;
  try {
    logger.warn({
      event: 'cv_generated_output_rejected',
      generation_id: claim.row.id,
      provider: claim.configuration.providerKey,
      mode: claim.selection.mode,
      reason,
    });
  } catch {
    // Diagnostics must not interrupt terminal persistence or acknowledgement.
  }
}

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
