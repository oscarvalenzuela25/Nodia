import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import type {
  CashMutationPayload,
  CashMutationReceipt,
  CashOperation,
  CashRejectedResult,
  KnownCashReceipt,
} from './types/cash.types.js';

export interface CashReceiptIdentity {
  businessId: string;
  actorId: string;
  requestKey: string;
}

export interface CashRequest<
  Operation extends CashOperation,
> extends CashReceiptIdentity {
  operation: Operation;
  fingerprint: string;
}

type TerminalResult<Operation extends CashOperation> =
  | { status: 'committed'; result: CashMutationPayload<Operation> }
  | { status: 'rejected'; error: CashRejectedResult };
type StoredReceipt<Operation extends CashOperation> = {
  operation: Operation;
  request_hash: string;
  attempt_id: string;
  contract_version: number;
} & (
  | TerminalResult<Operation>
  | { status: 'processing' | 'retryable'; expired: boolean }
);
export type CashReservation<Operation extends CashOperation> =
  { attemptId: string } | { receipt: KnownCashReceipt<Operation> };

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

  async reserve<Operation extends CashOperation>(
    manager: EntityManager,
    request: CashRequest<Operation>,
  ): Promise<CashReservation<Operation>> {
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

  async markRetryable(
    manager: EntityManager,
    identity: CashReceiptIdentity,
    attemptId: string,
  ): Promise<void> {
    await manager.query(
      `UPDATE business_cash_mutation_requests
       SET status='retryable', updated_at=clock_timestamp()
       WHERE business_id=$1 AND actor_id=$2 AND request_key=$3 AND attempt_id=$4
         AND status='processing' AND lease_expires_at>clock_timestamp()`,
      [...scopeParameters(identity), attemptId],
    );
  }

  async settle<Operation extends CashOperation>(
    manager: EntityManager,
    identity: CashReceiptIdentity,
    attemptId: string,
    outcome: TerminalResult<Operation>,
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
    const [row] = await manager.query<StoredReceipt<CashOperation>[]>(
      `SELECT operation, request_hash, attempt_id, contract_version, status, result, error,
              lease_expires_at<=clock_timestamp() AS expired
       FROM business_cash_mutation_requests
       WHERE business_id=$1 AND actor_id=$2 AND request_key=$3`,
      scopeParameters(identity),
    );
    return row;
  }

  private match<Operation extends CashOperation>(
    request: CashRequest<Operation>,
    entry?: StoredReceipt<CashOperation>,
  ): KnownCashReceipt<Operation> {
    if (!entry) throw unavailable();
    if (
      entry.operation !== request.operation ||
      entry.contract_version !== CASH_MUTATION_CONTRACT_VERSION ||
      entry.request_hash !== request.fingerprint
    ) {
      throw new ConflictException('business:cash_request_key_conflict');
    }
    // The checked operation identifies the persisted result contract.
    return this.project(request.requestKey, entry as StoredReceipt<Operation>);
  }

  private project<Operation extends CashOperation>(
    requestKey: string,
    entry: StoredReceipt<Operation>,
  ): KnownCashReceipt<Operation> {
    const identity = { request_key: requestKey, operation: entry.operation };
    if (entry.status === 'committed')
      return { ...identity, status: 'committed', result: entry.result };
    if (entry.status === 'rejected')
      return { ...identity, status: 'rejected', error: entry.error };
    return { ...identity, status: entry.expired ? 'retryable' : entry.status };
  }
}
