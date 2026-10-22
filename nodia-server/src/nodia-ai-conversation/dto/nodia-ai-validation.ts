import { BadRequestException } from '@nestjs/common';
import { plainToInstance, type ClassConstructor } from 'class-transformer';
import {
  registerDecorator,
  validateSync,
  type ValidationOptions,
} from 'class-validator';

export function IsUtf8Text(
  maxBytes: number,
  options?: ValidationOptions,
): PropertyDecorator {
  return (target, property) =>
    registerDecorator({
      name: 'isUtf8Text',
      target: target.constructor,
      propertyName: String(property),
      options,
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' &&
          /\S/u.test(value) &&
          Buffer.byteLength(value, 'utf8') <= maxBytes,
      },
    });
}
export function IsPostgresBigint(
  options?: ValidationOptions,
): PropertyDecorator {
  return (target, property) =>
    registerDecorator({
      name: 'isPostgresBigint',
      target: target.constructor,
      propertyName: String(property),
      options,
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' &&
          /^[1-9][0-9]{0,18}$/.test(value) &&
          BigInt(value) <= 9223372036854775807n,
      },
    });
}
/** Guard before class-transformer, which intentionally ignores prototype-sensitive keys. */
function rejectReservedKeys(
  value: unknown,
  ancestors = new WeakSet<object>(),
  depth = 0,
): void {
  if (!value || typeof value !== 'object') return;
  if (depth > 16 || ancestors.has(value))
    throw new BadRequestException('nodia_ai:invalid_input');
  ancestors.add(value);
  const keys = Object.getOwnPropertyNames(value);
  if (keys.length > 128 || Object.getOwnPropertySymbols(value).length > 0)
    throw new BadRequestException('nodia_ai:invalid_input');
  for (const key of keys) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype')
      throw new BadRequestException('nodia_ai:invalid_input');
    rejectReservedKeys(
      (value as Record<string, unknown>)[key],
      ancestors,
      depth + 1,
    );
  }
  ancestors.delete(value);
}
/** Internal calls have the same closed boundary as a future HTTP ValidationPipe. */
export function validateNodiaAiDto<T extends object>(
  type: ClassConstructor<T>,
  input: unknown,
): T {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    (Object.getPrototypeOf(input) !== Object.prototype &&
      !(input instanceof type))
  )
    throw new BadRequestException('nodia_ai:invalid_input');
  rejectReservedKeys(input);
  const result = plainToInstance(type, input, {
    enableImplicitConversion: false,
  });
  if (
    validateSync(result, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    }).length
  )
    throw new BadRequestException('nodia_ai:invalid_input');
  return result;
}
