import type { EntityManager } from 'typeorm';
import type { RentalProperty } from '../../rental-property/entities/rental-property.entity.js';

export type RentalResourceType =
  | 'property'
  | 'collaborator'
  | 'policy'
  | 'reservation'
  | 'payment'
  | 'expense'
  | 'block'
  | 'turnover';
export type RentalOperation =
  | 'property.create'
  | 'property.update'
  | 'collaborator.create'
  | 'collaborator.update'
  | 'policy.create'
  | 'policy.update'
  | 'reservation.create'
  | 'reservation.update'
  | 'reservation.confirm'
  | 'reservation.start'
  | 'reservation.complete'
  | 'reservation.cancel'
  | 'payment.create'
  | 'payment.void'
  | 'expense.create'
  | 'expense.update'
  | 'expense.pay'
  | 'expense.void'
  | 'block.create'
  | 'block.update'
  | 'turnover.update'
  | 'turnover.approve_same_day';
export interface RentalContext {
  manager: EntityManager;
  property: RentalProperty;
  actorId: string;
  now: Date;
  owner: boolean;
}
export interface RentalMutationOptions {
  actorId: string;
  propertyId: string;
  requestKey: string;
  operation: RentalOperation;
  resourceId: string | null;
  command: object;
  ownerOnly?: boolean;
}
export interface RentalEffect {
  resource_id: string;
  resource_type: RentalResourceType;
  status: string;
  updated_at: Date;
  changes: Record<string, unknown>;
}
export interface MutationResult {
  operation: RentalOperation;
  property_id: string;
  resource_type: RentalResourceType;
  resource_id: string;
  status: string;
  updated_at: string;
}
export interface RentalOperationResponse {
  schema_version: 1;
  http_status: 200 | 201;
  body: MutationResult;
}
export interface PlatformPolicyInput {
  reference: string;
  description: string;
}
export interface RentalPolicyRule {
  min_days_before: number;
  refund_percent: string;
}
export interface DirectPolicySnapshot {
  schema_version: 1;
  kind: 'direct';
  policy_id: string;
  policy_name: string;
  captured_at: string;
  timezone: string;
  days_basis: 'local_calendar_days';
  refund_basis: 'confirmed_received_amount';
  rounding: 'floor_clp';
  rules: RentalPolicyRule[];
}
export interface PlatformPolicySnapshot {
  schema_version: 1;
  kind: 'platform';
  channel: 'airbnb';
  captured_at: string;
  timezone: string;
  platform_reference: string;
  platform_description: string;
  resolution: 'manual_external';
}
export type RentalPolicySnapshot =
  DirectPolicySnapshot | PlatformPolicySnapshot;
export type RentalActive = 'active' | 'inactive' | 'all';
export interface RentalPage<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total_items: number;
    total_pages: number;
  };
}
