import { BadRequestException, ConflictException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import { RentalReservation } from '../rental-reservation/entities/rental-reservation.entity.js';
import { RentalCancellationPolicy } from '../rental-cancellation-policy/entities/rental-cancellation-policy.entity.js';
import { RentalCancellationRule } from '../rental-cancellation-policy/entities/rental-cancellation-policy-rule.entity.js';
import {
  isRentalId,
  isRentalPercent,
  normalizePercent,
} from './rental-validation.js';
import { isRentalInstant, isTimezone } from './rental-time.js';
import type {
  PlatformPolicyInput,
  RentalContext,
  RentalPolicyRule,
  RentalPolicySnapshot,
} from './types/rental.types.js';

export interface RentalPaymentTotals {
  received: bigint;
  refunded: bigint;
}
export async function paymentTotals(
  manager: EntityManager,
  propertyId: string,
  reservationId: string,
): Promise<RentalPaymentTotals> {
  const [row]: { received: string; refunded: string }[] = await manager.query(
    `SELECT COALESCE(SUM(amount) FILTER (WHERE type='payment'),0)::text received, COALESCE(SUM(amount) FILTER (WHERE type='refund'),0)::text refunded FROM rental_payments WHERE property_id=$1 AND reservation_id=$2 AND status='confirmed'`,
    [propertyId, reservationId],
  );
  return { received: BigInt(row.received), refunded: BigInt(row.refunded) };
}
export function basisPoints(percent: string): bigint {
  const [whole, fraction] = normalizePercent(percent).split('.');
  return BigInt(whole) * 100n + BigInt(fraction);
}
export function validatePolicyRules(rules: RentalPolicyRule[]): void {
  if (
    !Array.isArray(rules) ||
    !rules.length ||
    rules.length > 100 ||
    rules.some(
      (rule) => !rule || typeof rule !== 'object' || Array.isArray(rule),
    ) ||
    !rules.some((rule) => rule.min_days_before === 0) ||
    new Set(rules.map((rule) => rule.min_days_before)).size !== rules.length ||
    rules.some(
      (rule) =>
        !Number.isInteger(rule.min_days_before) ||
        rule.min_days_before < 0 ||
        rule.min_days_before > 36500 ||
        !isRentalPercent(rule.refund_percent),
    )
  )
    throw new BadRequestException('rental:invalid_input');
}
function keys(value: object, expected: string[]): boolean {
  return (
    Object.keys(value).length === expected.length &&
    Object.keys(value).every((key) => expected.includes(key))
  );
}
export function validatePolicySnapshot(value: unknown): RentalPolicySnapshot {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Buffer.byteLength(JSON.stringify(value)) > 16384
  )
    throw new BadRequestException('rental:invalid_input');
  const s = value as RentalPolicySnapshot;
  if (
    s.schema_version !== 1 ||
    !isRentalInstant(s.captured_at) ||
    !isTimezone(s.timezone)
  )
    throw new BadRequestException('rental:invalid_input');
  if (s.kind === 'direct') {
    if (
      !keys(s, [
        'schema_version',
        'kind',
        'policy_id',
        'policy_name',
        'captured_at',
        'timezone',
        'days_basis',
        'refund_basis',
        'rounding',
        'rules',
      ]) ||
      !isRentalId(s.policy_id) ||
      typeof s.policy_name !== 'string' ||
      s.policy_name.length < 1 ||
      s.policy_name.length > 255 ||
      s.days_basis !== 'local_calendar_days' ||
      s.refund_basis !== 'confirmed_received_amount' ||
      s.rounding !== 'floor_clp'
    )
      throw new BadRequestException('rental:invalid_input');
    validatePolicyRules(s.rules);
    if (
      s.rules.some((rule) => !keys(rule, ['min_days_before', 'refund_percent']))
    )
      throw new BadRequestException('rental:invalid_input');
  } else if (s.kind === 'platform') {
    if (
      !keys(s, [
        'schema_version',
        'kind',
        'channel',
        'captured_at',
        'timezone',
        'platform_reference',
        'platform_description',
        'resolution',
      ]) ||
      s.channel !== 'airbnb' ||
      s.resolution !== 'manual_external' ||
      typeof s.platform_reference !== 'string' ||
      s.platform_reference.length < 1 ||
      s.platform_reference.length > 255 ||
      typeof s.platform_description !== 'string' ||
      s.platform_description.length < 1 ||
      s.platform_description.length > 5000
    )
      throw new BadRequestException('rental:invalid_input');
  } else throw new BadRequestException('rental:invalid_input');
  return s;
}
export async function capturePolicySnapshot(
  context: RentalContext,
  reservation: RentalReservation,
  platformPolicy?: PlatformPolicyInput,
): Promise<RentalPolicySnapshot> {
  if (reservation.property_id !== context.property.id)
    throw new BadRequestException('rental:invalid_input');
  if (reservation.policy_snapshot) {
    const saved = validatePolicySnapshot(reservation.policy_snapshot);
    if (
      saved.timezone !== context.property.timezone ||
      (reservation.channel === 'airbnb') !== (saved.kind === 'platform')
    )
      throw new ConflictException('rental:agreement_immutable');
    if (
      platformPolicy &&
      (saved.kind !== 'platform' ||
        saved.platform_reference !== platformPolicy.reference ||
        saved.platform_description !== platformPolicy.description)
    )
      throw new ConflictException('rental:agreement_immutable');
    return saved;
  }
  let snapshot: RentalPolicySnapshot;
  if (reservation.channel === 'airbnb') {
    if (
      !platformPolicy ||
      !reservation.external_reference ||
      reservation.cancellation_policy_id !== null ||
      reservation.deposit_amount !== '0'
    )
      throw new BadRequestException('rental:invalid_input');
    snapshot = {
      schema_version: 1,
      kind: 'platform',
      channel: 'airbnb',
      captured_at: context.now.toISOString(),
      timezone: context.property.timezone,
      platform_reference: platformPolicy.reference,
      platform_description: platformPolicy.description,
      resolution: 'manual_external',
    };
  } else {
    if (platformPolicy || !reservation.cancellation_policy_id)
      throw new BadRequestException('rental:invalid_input');
    const policy = await context.manager
      .getRepository(RentalCancellationPolicy)
      .findOneBy({
        id: reservation.cancellation_policy_id,
        property_id: context.property.id,
        is_active: true,
      });
    if (!policy) throw new ConflictException('rental:invalid_input');
    const rules = await context.manager
      .getRepository(RentalCancellationRule)
      .find({
        where: { policy_id: policy.id },
        order: { min_days_before: 'ASC' },
        take: 101,
      });
    const projected = rules.map((rule) => ({
      min_days_before: rule.min_days_before,
      refund_percent: normalizePercent(rule.refund_percent),
    }));
    validatePolicyRules(projected);
    snapshot = {
      schema_version: 1,
      kind: 'direct',
      policy_id: policy.id,
      policy_name: policy.name,
      captured_at: context.now.toISOString(),
      timezone: context.property.timezone,
      days_basis: 'local_calendar_days',
      refund_basis: 'confirmed_received_amount',
      rounding: 'floor_clp',
      rules: projected,
    };
  }
  return validatePolicySnapshot(snapshot);
}
/** Hash the complete confirmed payment ledger with bounded keyset pages. */
export async function paymentLedgerHash(
  manager: EntityManager,
  propertyId: string,
  reservationId: string,
): Promise<{ hash: string; count: number }> {
  const digest = createHash('sha256');
  digest.update('[');
  let last = '0',
    count = 0;
  for (;;) {
    const rows: { id: string; amount: string; occurred_on: string }[] =
      await manager.query(
        `SELECT id::text,amount::text,to_char(occurred_on,'YYYY-MM-DD') occurred_on FROM rental_payments WHERE property_id=$1 AND reservation_id=$2 AND type='payment' AND status='confirmed' AND id>$3::bigint ORDER BY id LIMIT 500`,
        [propertyId, reservationId, last],
      );
    for (const row of rows) {
      if (count) digest.update(',');
      digest.update(
        JSON.stringify({
          amount: row.amount,
          id: row.id,
          occurred_on: row.occurred_on,
        }),
      );
      count++;
      last = row.id;
    }
    if (rows.length < 500) break;
  }
  digest.update(']');
  return { hash: digest.digest('hex'), count };
}
