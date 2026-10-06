import {
  BadRequestException,
  ValidationPipe,
  type ArgumentMetadata,
} from '@nestjs/common';

/** Keep rental validation errors stable without changing other module contracts. */
export class RentalValidationPipe extends ValidationPipe {
  override async transform(
    value: unknown,
    metadata: ArgumentMetadata,
  ): Promise<unknown> {
    try {
      return await super.transform(value, metadata);
    } catch (error) {
      if (
        metadata.metatype?.name.includes('Rental') &&
        error instanceof BadRequestException
      )
        throw new BadRequestException('rental:invalid_input');
      throw error;
    }
  }
}
