import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { NodiaAiJsonObject } from '../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { paymentTotals } from '../rental-common/rental-money.js';

/** Material projections, always under the caller's authority and property write lock. */
@Injectable()
export class NodiaAiRentalMoneyService {
  async property(manager: EntityManager, id: string) {
    const rows: NodiaAiJsonObject[] = await manager.query(
      'SELECT id::text,owner_id::text,timezone,is_active FROM rental_properties WHERE id=$1 FOR UPDATE',
      [id],
    );
    return rows[0] ?? null;
  }
  async member(manager: EntityManager, property: string, user: string) {
    const rows: { is_active: boolean }[] = await manager.query(
      'SELECT is_active FROM rental_collaborators WHERE property_id=$1 AND user_id=$2',
      [property, user],
    );
    return rows[0]?.is_active === true;
  }
  async reservation(manager: EntityManager, property: string, id: string) {
    const rows: NodiaAiJsonObject[] = await manager.query(
      `SELECT id::text,property_id::text,status,channel,total_amount::text,commission_amount::text,
       deposit_amount::text,external_reference,cancellation_policy_id::text,policy_snapshot,
       cancelled_at::text,refund_amount::text FROM rental_reservations WHERE property_id=$1 AND id=$2 FOR UPDATE`,
      [property, id],
    );
    return rows[0] ?? null;
  }
  async payment(manager: EntityManager, property: string, id: string) {
    const rows: NodiaAiJsonObject[] = await manager.query(
      `SELECT id::text,property_id::text,reservation_id::text,type,amount::text,
       to_char(occurred_on,'YYYY-MM-DD') occurred_on,status FROM rental_payments WHERE property_id=$1 AND id=$2`,
      [property, id],
    );
    return rows[0] ?? null;
  }
  async expense(manager: EntityManager, property: string, id: string) {
    const rows: NodiaAiJsonObject[] = await manager.query(
      `SELECT id::text,property_id::text,name,amount::text,to_char(incurred_on,'YYYY-MM-DD') incurred_on,
       to_char(paid_on,'YYYY-MM-DD') paid_on,status,reservation_id::text,category,notes
       FROM rental_expenses WHERE property_id=$1 AND id=$2`,
      [property, id],
    );
    return rows[0] ?? null;
  }
  async totals(manager: EntityManager, property: string, reservation: string) {
    const totals = await paymentTotals(manager, property, reservation);
    return {
      received: totals.received.toString(),
      refunded: totals.refunded.toString(),
    };
  }
}
