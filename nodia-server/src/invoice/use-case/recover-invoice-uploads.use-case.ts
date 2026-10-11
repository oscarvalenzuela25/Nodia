import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { StorageService } from '../../common/storage/storage.service.js';
import { Invoice } from '../entities/invoice.entity.js';

interface CleanupClaim {
  storage_key: string;
  cleanup_attempts: number;
}

@Injectable()
export class RecoverInvoiceUploadsUseCase {
  private readonly logger = new Logger(RecoverInvoiceUploadsUseCase.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly storageService: StorageService,
  ) {}

  /** A key is only supplied by creation after its PUT has settled. */
  async execute(
    key?: string,
  ): Promise<{ cleaned: number; retained: number; deferred: number }> {
    const result = { cleaned: 0, retained: 0, deferred: 0 };
    for (let index = 0; index < (key ? 1 : 5); index++) {
      // Claim in one short SQL statement. SKIP LOCKED coordinates replicas;
      // the 60s lease exceeds the bounded 10s DELETE, including SDK retries.
      const [claim]: CleanupClaim[] = await this.dataSource.query(
        `
        WITH claimed AS (
        UPDATE invoice_uploads AS upload
        SET cleanup_started = true, cleanup_attempts = upload.cleanup_attempts + 1,
            retry_after = clock_timestamp() + INTERVAL '1 minute'
        FROM (
          SELECT storage_key FROM invoice_uploads
          WHERE ${key ? 'storage_key = $1 AND (NOT cleanup_started OR retry_after <= clock_timestamp())' : 'retry_after <= clock_timestamp()'}
          ORDER BY retry_after, storage_key
          FOR UPDATE SKIP LOCKED LIMIT 1
        ) AS pending
        WHERE upload.storage_key = pending.storage_key
        RETURNING upload.storage_key, upload.cleanup_attempts
        ) SELECT storage_key, cleanup_attempts FROM claimed
      `,
        key ? [key] : [],
      );
      if (!claim) break;

      try {
        // A commit whose response was lost must never trigger file deletion.
        const attached = await this.dataSource
          .getRepository(Invoice)
          .existsBy({ path_storage: claim.storage_key });
        if (attached) {
          await this.dataSource.query(
            'DELETE FROM invoice_uploads WHERE storage_key = $1',
            [claim.storage_key],
          );
          result.retained++;
          continue;
        }
        await this.storageService.deleteFile(claim.storage_key);
        // Keep a tombstone through the grace period: an uncertain PUT may
        // finish remotely after its caller timed out. Delete once more later.
        await this.dataSource.query(
          `
          DELETE FROM invoice_uploads WHERE storage_key = $1 AND cleanup_after <= clock_timestamp()
        `,
          [claim.storage_key],
        );
        await this.dataSource.query(
          `
          UPDATE invoice_uploads SET retry_after = cleanup_after WHERE storage_key = $1
        `,
          [claim.storage_key],
        );
        result.cleaned++;
      } catch {
        const delaySeconds = Math.min(
          60 * 2 ** Math.min(claim.cleanup_attempts - 1, 6),
          3600,
        );
        await this.dataSource.query(
          `
          UPDATE invoice_uploads SET retry_after = clock_timestamp() + $2 * INTERVAL '1 second'
          WHERE storage_key = $1
        `,
          [claim.storage_key, delaySeconds],
        );
        this.logger.warn({
          event: 'invoice_upload_cleanup_deferred',
          storageKey: claim.storage_key,
          attempts: claim.cleanup_attempts,
        });
        result.deferred++;
      }
    }
    return result;
  }
}
