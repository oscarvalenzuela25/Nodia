import { BadRequestException } from '@nestjs/common';

/** UI preference only: this flag does not grant or revoke invoice/product authority. */
export function validateProviderOcrPreference(value: unknown): void {
  if (value !== undefined && typeof value !== 'boolean')
    throw new BadRequestException('business:provider_use_ocr_invalid');
}
