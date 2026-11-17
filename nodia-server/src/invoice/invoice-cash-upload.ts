import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import type { ActorReference } from '../authorization/authority-transaction.js';
import { CashBusinessScope } from '../business-cash/cash-business-scope.js';
import { CashMutationRequestsService } from '../business-cash/cash-mutation-requests.service.js';
import type { CashMutationAttempt } from '../business-cash/use-case/execute-cash-mutation.use-case.js';
import { StorageService } from '../common/storage/storage.service.js';
import { validateInvoiceFile } from './invoice-file-validation.js';

export function describeInvoiceUpload(file: Express.Multer.File) {
  return {
    buffer: file.buffer,
    extension: validateInvoiceFile(file),
    mime_type: file.mimetype,
    sha256: createHash('sha256').update(file.buffer).digest('hex'),
  };
}

export type InvoiceCashUpload = ReturnType<typeof describeInvoiceUpload>;

const unavailable = () =>
  new ServiceUnavailableException('business:cash_mutation_unavailable');

const uploadKey = (attempt: CashMutationAttempt, file: InvoiceCashUpload) =>
  `invoices/${attempt.businessId}/${attempt.attemptId}.${file.extension}`;

@Injectable()
export class InvoiceCashUploadService {
  constructor(
    private readonly scope: CashBusinessScope,
    private readonly requests: CashMutationRequestsService,
    private readonly storage: StorageService,
  ) {}

  async stage(
    attempt: CashMutationAttempt,
    actor: ActorReference,
    file: InvoiceCashUpload,
  ): Promise<void> {
    const key = uploadKey(attempt, file);
    await this.scope.run(attempt.businessId, actor, async (manager) => {
      await this.requests.holdAttempt(manager, attempt, attempt.attemptId);
      await manager.query(
        `INSERT INTO invoice_uploads(storage_key, cleanup_after, retry_after, cash_attempt_id)
         VALUES ($1, clock_timestamp() + interval '10 minutes', clock_timestamp() + interval '10 minutes', $2)`,
        [key, attempt.attemptId],
      );
    });
    try {
      await this.storage.uploadFileOnce(key, file.buffer, file.mime_type);
    } catch {
      // The old key remains in quarantine. A retry uses a fresh attempt/key
      // even when the storage provider may still finish the failed PUT.
      await this.scope.run(attempt.businessId, actor, (manager) =>
        this.requests.markRetryable(manager, attempt, attempt.attemptId),
      );
      throw unavailable();
    }
    await this.scope.run(attempt.businessId, actor, async (manager) => {
      await this.requests.holdAttempt(manager, attempt, attempt.attemptId);
      const [row] = await manager.query<{ storage_key: string }[]>(
        `WITH marked AS (
           UPDATE invoice_uploads SET uploaded_at=clock_timestamp()
           WHERE storage_key=$1 AND cash_attempt_id=$2
             AND NOT cleanup_started AND cleanup_after>clock_timestamp()
           RETURNING storage_key
         ) SELECT storage_key FROM marked`,
        [key, attempt.attemptId],
      );
      if (!row) throw unavailable();
    });
  }

  async lockPrepared(
    manager: EntityManager,
    attempt: CashMutationAttempt,
    file: InvoiceCashUpload,
  ): Promise<string> {
    const key = uploadKey(attempt, file);
    const [ready] = await manager.query<{ storage_key: string }[]>(
      `SELECT storage_key FROM invoice_uploads
       WHERE storage_key=$1 AND cash_attempt_id=$2
         AND uploaded_at IS NOT NULL AND NOT cleanup_started
         AND cleanup_after>clock_timestamp() FOR UPDATE`,
      [key, attempt.attemptId],
    );
    if (!ready) throw unavailable();
    return ready.storage_key;
  }

  async consume(
    manager: EntityManager,
    attempt: CashMutationAttempt,
    key: string,
  ): Promise<void> {
    await manager.query(
      'DELETE FROM invoice_uploads WHERE storage_key=$1 AND cash_attempt_id=$2',
      [key, attempt.attemptId],
    );
  }
}
