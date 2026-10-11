import { BadRequestException } from '@nestjs/common';
import { IsString, Matches } from 'class-validator';

export class CatalogIdDto {
  @IsString({ message: 'modules:invalid_id' })
  @Matches(/^[1-9]\d{0,18}$/, { message: 'modules:invalid_id' })
  id: string;
}

export function validateCatalogId(
  id: string,
  message = 'modules:invalid_id',
): void {
  if (
    typeof id !== 'string' ||
    !/^[1-9]\d{0,18}$/.test(id) ||
    BigInt(id) > 9223372036854775807n
  ) {
    throw new BadRequestException(message);
  }
}
