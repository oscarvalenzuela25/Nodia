import { ConflictException } from '@nestjs/common';

export function throwFinanceCatalogError(error: unknown): never {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? error.code
      : undefined;
  if (code === '23505') throw new ConflictException('finance:duplicate_key');
  if (code === '23503')
    throw new ConflictException('finance:association_conflict');
  throw error;
}
