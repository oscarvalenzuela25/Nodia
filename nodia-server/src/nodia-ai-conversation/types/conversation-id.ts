import { BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';

/** Shared identifier validation without importing a resource use case. */
export function conversationId(input: string): string {
  if (!isUUID(input, '4'))
    throw new BadRequestException('nodia_ai:invalid_input');
  return input.toLowerCase();
}
