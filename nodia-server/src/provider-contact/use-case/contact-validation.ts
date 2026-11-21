import { BadRequestException, ConflictException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { isEmail, isUUID } from 'class-validator';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import {
  CONTACT_DAYS,
  type ContactValues,
  type ContactSchedule,
} from '../types/provider-contact.types.js';

const object = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const invalid = (field: string): never => {
  throw new BadRequestException(`Invalid contact ${field}`);
};
export function validateContactId(id: string): void {
  if (
    typeof id !== 'string' ||
    !/^[1-9]\d{0,18}$/.test(id) ||
    BigInt(id) > 9223372036854775807n
  )
    invalid('id');
}
export function validateRequestKey(key: string): void {
  if (typeof key !== 'string' || !isUUID(key, '4')) invalid('request_key');
}
export function validateVersion(version: number): void {
  if (!Number.isInteger(version) || version < 1 || version > 2147483646)
    invalid('version');
}
export function hasPendingContactVisit(schedule: unknown): boolean {
  return (
    object(schedule) &&
    CONTACT_DAYS.some((day) => {
      const visits = schedule[day];
      return (
        Array.isArray(visits) &&
        visits.some(
          (visit) => object(visit) && visit.from === null && visit.to === null,
        )
      );
    })
  );
}
export function assertPendingContactVisitsSpecified(
  current: ContactSchedule,
  replacement: ContactSchedule,
): void {
  if (
    CONTACT_DAYS.some(
      (day) => current[day]?.[0]?.from === null && !Object.hasOwn(replacement, day),
    )
  ) {
    throw new ConflictException(
      'Reload the contact before editing its pending visit days',
    );
  }
}
export function normalizeContact(input: ContactValues): ContactValues {
  if (
    typeof input.name !== 'string' ||
    !input.name.trim() ||
    input.name.trim().length > 255
  )
    invalid('name');
  if (!Array.isArray(input.phone) || input.phone.length > 10) invalid('phone');
  const phone = input.phone.map((value) => {
    if (
      !object(value) ||
      Object.keys(value).some((key) => key !== 'number') ||
      typeof value.number !== 'string' ||
      !/^\+[1-9]\d{6,14}$/.test(value.number)
    )
      invalid('phone');
    const parsed = parsePhoneNumberFromString(value.number, { extract: false });
    if (!parsed) return invalid('phone');
    if (!parsed.isValid() || parsed.ext || parsed.number !== value.number)
      invalid('phone');
    return { number: parsed.number as string };
  });
  if (new Set(phone.map((p) => p.number)).size !== phone.length)
    invalid('duplicate phone');
  const email = input.email === null || input.email === '' ? null : input.email;
  if (
    email !== null &&
    (typeof email !== 'string' || email.length > 254 || !isEmail(email))
  )
    invalid('email');
  if (
    input.description !== null &&
    (typeof input.description !== 'string' || input.description.length > 2000)
  )
    invalid('description');
  if (typeof input.is_active !== 'boolean') invalid('is_active');
  if (
    !object(input.schedule) ||
    Object.keys(input.schedule).some(
      (key) => !(CONTACT_DAYS as readonly string[]).includes(key),
    )
  )
    invalid('schedule');
  const schedule: ContactSchedule = {};
  for (const day of CONTACT_DAYS) {
    const ranges = input.schedule[day];
    if (ranges === undefined) continue;
    if (!Array.isArray(ranges) || ranges.length > 1) invalid('schedule');
    if (!ranges.length) continue;
    schedule[day] = ranges.map((range) => {
      if (
        !object(range) ||
        Object.keys(range).some(
          (key) => !['from', 'to', 'description'].includes(key),
        )
      )
        invalid('schedule');
      const { from, to, description } = range;
      if (
        description !== undefined &&
        (typeof description !== 'string' || description.length > 255)
      )
        invalid('schedule description');
      const note = typeof description === 'string' ? description.trim() : '';
      const details = note ? { description: note } : {};
      if (from === null && to === null) return { from, to, ...details };
      if (
        typeof from !== 'string' ||
        typeof to !== 'string' ||
        !time.test(from) ||
        !time.test(to) ||
        from >= to
      )
        return invalid('schedule');
      return { from, to, ...details };
    });
  }
  return {
    name: input.name.trim(),
    phone,
    email,
    schedule,
    description: input.description?.trim() || null,
    is_active: input.is_active,
  };
}
export function contactHash(value: ContactValues): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
