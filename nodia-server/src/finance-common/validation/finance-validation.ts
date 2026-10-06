import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsString,
  MaxLength,
  MinLength,
  registerDecorator,
  ValidateIf,
  type ValidationOptions,
} from 'class-validator';

export const FINANCE_BIGINT_MAX = 9223372036854775807n;

export function isFinanceBigint(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[1-9]\d{0,18}$/.test(value) &&
    BigInt(value) <= FINANCE_BIGINT_MAX
  );
}

/** IDs and amounts stay decimal strings across JSON, TypeORM and PostgreSQL. */
export function IsFinanceBigint(
  options?: ValidationOptions,
): PropertyDecorator {
  return (target, propertyKey) =>
    registerDecorator({
      name: 'isFinanceBigint',
      target: target.constructor,
      propertyName: String(propertyKey),
      options,
      validator: {
        validate: isFinanceBigint,
        defaultMessage: () => 'finance:invalid_positive_integer',
      },
    });
}

export function FinanceText(): PropertyDecorator {
  return (target, propertyKey) => {
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim() : value,
    )(target, propertyKey);
    IsString()(target, propertyKey);
    MinLength(1)(target, propertyKey);
    MaxLength(255)(target, propertyKey);
  };
}

/** Unlike IsOptional, a supplied null is validated unless explicitly nullable. */
export function OptionalFinanceField(
  options: { nullable?: boolean } = {},
): PropertyDecorator {
  return ValidateIf(
    (_object, value: unknown) =>
      value !== undefined && !(options.nullable && value === null),
  );
}

export function FinanceIdArray(): PropertyDecorator {
  return (target, propertyKey) => {
    IsArray()(target, propertyKey);
    ArrayMaxSize(100)(target, propertyKey);
    ArrayUnique()(target, propertyKey);
    IsFinanceBigint({ each: true })(target, propertyKey);
  };
}
