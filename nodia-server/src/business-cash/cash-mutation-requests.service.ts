import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import type {
  CashCategory,
  CashCategoryOperation,
  CashMutationReceipt,
  CashRejectedResult,
} from './types/cash.types.js';

export interface CashReceiptIdentity {
  businessId: string;
  actorId: string;
  requestKey: string;
}

interface CashRequest extends CashReceiptIdentity {
  operation: CashCategoryOperation;
  fingerprint: string;
}

type CashCategoryResult = { category: CashCategory };
type TerminalResult =
  | { status: 'committed'; result: CashCategoryResult }
  | { status: 'rejected'; error: CashRejectedResult };
type StoredReceipt = {
  operation: CashCategoryOperation;
  request_hash: string;
  attempt_id: string;
  contract_version: number;
} & (TerminalResult | { status: 'processing' | 'retryable'; expired: boolean });
type KnownReceipt = Exclude<CashMutationReceipt, { status: 'unconfirmed' }>;
type Reservation = { attemptId: string } | { receipt: KnownReceipt };

export const CASH_MUTATION_CONTRACT_VERSION = 1;

const scopeParameters = (
  identity: CashReceiptIdentity,
): [string, string, string] => [
  identity.businessId,
  identity.actorId,
  identity.requestKey,
];

const unavailable = () =>
  new ServiceUnavailableException('business:cash_mutation_unavailable');

@Injectable()
export class CashMutationRequestsService {
  async read(
    manager: EntityManager,
    identity: CashReceiptIdentity,
  ): Promise<CashMutationReceipt> {
    const entry = await this.find(manager, identity);
    return entry
      ? this.project(identity.requestKey, entry)
      : {
          request_key: identity.requestKey,
          status: 'unconfirmed',
        };
  }

  async reserve(
    manager: EntityManager,
    request: CashRequest,
  ): Promise<Reservation> {
    const parameters = scopeParameters(request);
    let entry = await this.find(manager, request);
    if (!entry) {
      const attemptId = randomUUID();
      const rows = await manager.query<{ attempt_id: string }[]>(
        `INSERT INTO business_cash_mutation_requests
          (business_id, actor_id, request_key, operation, request_hash, contract_version, status, attempt_id, lease_expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,'processing',$7,clock_timestamp() + interval '120 seconds')
         ON CONFLICT (business_id, actor_id, request_key) DO NOTHING
         RETURNING attempt_id`,
        [
          ...parameters,
          request.operation,
          request.fingerprint,
          CASH_MUTATION_CONTRACT_VERSION,
          attemptId,
        ],
      );
      if (rows.length) return { attemptId };
      entry = await this.find(manager, request);
    }

    if (!entry) throw unavailable();
    const receipt = this.match(request, entry);
    if (receipt.status !== 'retryable') return { receipt };
    const attemptId = randomUUID();
    const rows = await manager.query<{ attempt_id: string }[]>(
      `WITH claimed AS (
         UPDATE business_cash_mutation_requests
         SET status='processing', attempt_id=$5,
             lease_expires_at=clock_timestamp() + interval '120 seconds', updated_at=clock_timestamp()
         WHERE business_id=$1 AND actor_id=$2 AND request_key=$3 AND attempt_id=$4
           AND (status='retryable' OR (status='processing' AND lease_expires_at<=clock_timestamp()))
         RETURNING attempt_id
       ) SELECT attempt_id FROM claimed`,
      [...parameters, entry.attempt_id, attemptId],
    );
    if (rows.length) return { attemptId };

    // A concurrent attempt may have committed while the reclaim was waiting.
    const current = this.match(request, await this.find(manager, request));
    if (current.status === 'retryable') throw unavailable();
    return { receipt: current };
  }

  async holdAttempt(
    manager: EntityManager,
    identity: CashReceiptIdentity,
    attemptId: string,
  ): Promise<void> {
    const rows = await manager.query<{ attempt_id: string }[]>(
      `SELECT attempt_id FROM business_cash_mutation_requests
       WHERE business_id=$1 AND actor_id=$2 AND request_key=$3 AND attempt_id=$4
         AND status='processing' AND lease_expires_at>clock_timestamp()
       FOR UPDATE`,
      [...scopeParameters(identity), attemptId],
    );
    if (!rows.length) throw unavailable();
  }

  async settle(
    manager: EntityManager,
    identity: CashReceiptIdentity,
    attemptId: string,
    outcome: TerminalResult,
  ): Promise<void> {
    const rows = await manager.query<{ attempt_id: string }[]>(
      `WITH settled AS (
         UPDATE business_cash_mutation_requests
         SET status=$5, result=$6::jsonb, error=$7::jsonb, updated_at=clock_timestamp()
         WHERE business_id=$1 AND actor_id=$2 AND request_key=$3 AND attempt_id=$4
           AND status='processing' AND lease_expires_at>clock_timestamp()
         RETURNING attempt_id
       ) SELECT attempt_id FROM settled`,
      [
        ...scopeParameters(identity),
        attemptId,
        outcome.status,
        outcome.status === 'committed' ? JSON.stringify(outcome.result) : null,
        outcome.status === 'rejected' ? JSON.stringify(outcome.error) : null,
      ],
    );
    if (!rows.length) throw unavailable();
  }

  private async find(manager: EntityManager, identity: CashReceiptIdentity) {
    const [row] = await manager.query<StoredReceipt[]>(
      `SELECT operation, request_hash, attempt_id, contract_version, status, result, error,
              lease_expires_at<=clock_timestamp() AS expired
       FROM business_cash_mutation_requests
       WHERE business_id=$1 AND actor_id=$2 AND request_key=$3`,
      scopeParameters(identity),
    );
    return row;
  }

  private match(request: CashRequest, entry?: StoredReceipt): KnownReceipt {
    if (!entry) throw unavailable();
    if (
      entry.operation !== request.operation ||
      entry.contract_version !== CASH_MUTATION_CONTRACT_VERSION ||
      entry.request_hash !== request.fingerprint
    ) {
      throw new ConflictException('business:cash_request_key_conflict');
    }
    return this.project(request.requestKey, entry);
  }

  private project(requestKey: string, entry: StoredReceipt): KnownReceipt {
    const identity = { request_key: requestKey, operation: entry.operation };
    if (entry.status === 'committed')
      return { ...identity, status: 'committed', result: entry.result };
    if (entry.status === 'rejected')
      return { ...identity, status: 'rejected', error: entry.error };
    return { ...identity, status: entry.expired ? 'retryable' : entry.status };
  }
}
