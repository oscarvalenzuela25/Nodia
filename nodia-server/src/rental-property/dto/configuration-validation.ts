import {
  validateRentalDto,
  requireNonEmptyUpdate,
  isRentalId,
  normalizePercent,
} from '../../rental-common/rental-validation.js';
export const configurationId = isRentalId;
export const normalizeConfigurationPercent = normalizePercent;
export async function configurationCommand<T extends object>(
  dto: new () => T,
  value: unknown,
  partial = false,
): Promise<T> {
  const result = await validateRentalDto(dto, value);
  if (partial) requireNonEmptyUpdate(result);
  return result;
}
