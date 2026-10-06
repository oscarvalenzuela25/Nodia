import { BadRequestException } from '@nestjs/common';
import {
  plainToInstance,
  Transform,
  type ClassConstructor,
} from 'class-transformer';
import {
  IsString,
  MaxLength,
  MinLength,
  registerDecorator,
  ValidateIf,
  validate,
  type ValidationOptions,
} from 'class-validator';
import {
  isCivilDate,
  isLocalTime,
  isRentalInstant,
  isTimezone,
} from './rental-time.js';

export const RENTAL_BIGINT_MAX = 9223372036854775807n;
export function isRentalMoney(
  value: unknown,
  positive = false,
): value is string {
  return (
    typeof value === 'string' &&
    /^(?:0|[1-9]\d{0,18})$/.test(value) &&
    BigInt(value) <= RENTAL_BIGINT_MAX &&
    (!positive || BigInt(value) > 0n)
  );
}
export function isRentalId(value: unknown): value is string {
  return isRentalMoney(value, true);
}
export function isRentalPercent(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^(?:0|[1-9]\d?|100)(?:\.\d{1,2})?$/.test(value) &&
    Number(value) <= 100
  );
}
function predicate(
  name: string,
  check: (value: unknown) => boolean,
  options?: ValidationOptions,
): PropertyDecorator {
  return (target, key) =>
    registerDecorator({
      name,
      target: target.constructor,
      propertyName: String(key),
      options,
      validator: {
        validate: check,
        defaultMessage: () => 'rental:invalid_input',
      },
    });
}
export function IsRentalId(options?: ValidationOptions): PropertyDecorator {
  return predicate('rentalId', isRentalId, options);
}
export function IsRentalMoney(positive = false): PropertyDecorator {
  return predicate('rentalMoney', (value) => isRentalMoney(value, positive));
}
export function IsRentalPercent(): PropertyDecorator {
  return predicate('rentalPercent', isRentalPercent);
}
export function IsCivilDate(): PropertyDecorator {
  return predicate('rentalDate', isCivilDate);
}
export function IsLocalTime(): PropertyDecorator {
  return predicate('rentalTime', isLocalTime);
}
export function IsRentalInstant(): PropertyDecorator {
  return predicate('rentalInstant', isRentalInstant);
}
export function IsTimezone(): PropertyDecorator {
  return predicate('rentalTimezone', isTimezone);
}
export function OptionalNullable(): PropertyDecorator {
  return ValidateIf(
    (_object, value: unknown) => value !== undefined && value !== null,
  );
}
export function OptionalDefined(): PropertyDecorator {
  return ValidateIf((_object, value: unknown) => value !== undefined);
}
export function RentalText(max = 255, nullable = false): PropertyDecorator {
  return (target, key) => {
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string'
        ? nullable && !value.trim()
          ? null
          : value.trim()
        : value,
    )(target, key);
    IsString()(target, key);
    MinLength(1)(target, key);
    MaxLength(max)(target, key);
  };
}
export async function validateRentalDto<T extends object>(
  type: ClassConstructor<T>,
  input: unknown,
): Promise<T> {
  if (input === null || typeof input !== 'object' || Array.isArray(input))
    throw new BadRequestException('rental:invalid_input');
  const result = plainToInstance(type, input);
  const errors = await validate(result, {
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
  });
  if (errors.length) throw new BadRequestException('rental:invalid_input');
  return result;
}
export function requireNonEmptyUpdate(dto: object): void {
  if (!Object.values(dto).some((value) => value !== undefined))
    throw new BadRequestException('rental:invalid_input');
}
export function normalizePercent(value: string): string {
  if (!isRentalPercent(value))
    throw new BadRequestException('rental:invalid_input');
  const [whole, fraction = ''] = value.split('.');
  return `${whole}.${fraction.padEnd(2, '0')}`;
}

export function assertEmptyCommand(input: unknown): void {
  if (
    input === null ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).length
  )
    throw new BadRequestException('rental:invalid_input');
}
