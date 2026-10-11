import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataSource } from 'typeorm';
import type { StorageService } from '../../common/storage/storage.service.js';
import { RecoverInvoiceUploadsUseCase } from './recover-invoice-uploads.use-case.js';

describe('RecoverInvoiceUploadsUseCase', () => {
  const key = 'invoices/synthetic-business/synthetic-object.pdf';
  let query: ReturnType<typeof vi.fn>;
  let existsBy: ReturnType<typeof vi.fn>;
  let deleteFile: ReturnType<typeof vi.fn>;
  let useCase: RecoverInvoiceUploadsUseCase;

  beforeEach(() => {
    let claimed = false;
    query = vi.fn(async (sql: string) => {
      if (sql.includes('RETURNING') && !claimed) {
        claimed = true;
        return [{ storage_key: key, cleanup_attempts: 1 }];
      }
      return [];
    });
    existsBy = vi.fn().mockResolvedValue(false);
    deleteFile = vi.fn().mockResolvedValue(undefined);
    useCase = new RecoverInvoiceUploadsUseCase(
      { query, getRepository: () => ({ existsBy }) } as unknown as DataSource,
      { deleteFile } as unknown as StorageService,
    );
  });

  it('only deletes the exact object claimed in the durable journal', async () => {
    await expect(useCase.execute(key)).resolves.toEqual({
      cleaned: 1,
      retained: 0,
      deferred: 0,
    });
    expect(deleteFile).toHaveBeenCalledWith(key);
    expect(existsBy).toHaveBeenCalledWith({ path_storage: key });
    expect(query.mock.calls[0][0]).toContain('SKIP LOCKED');
  });

  it('never deletes an object referenced by a committed invoice', async () => {
    existsBy.mockResolvedValueOnce(true);
    await expect(useCase.execute(key)).resolves.toEqual({
      cleaned: 0,
      retained: 1,
      deferred: 0,
    });
    expect(deleteFile).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledWith(
      'DELETE FROM invoice_uploads WHERE storage_key = $1',
      [key],
    );
  });

  it('does not delete anything when another worker owns the lease or the intent is absent', async () => {
    query.mockResolvedValue([]);
    await expect(useCase.execute(key)).resolves.toEqual({
      cleaned: 0,
      retained: 0,
      deferred: 0,
    });
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it('preserves the journal with backoff if R2 refuses deletion', async () => {
    deleteFile.mockRejectedValueOnce(new Error('R2 unavailable'));
    await expect(useCase.execute(key)).resolves.toEqual({
      cleaned: 0,
      retained: 0,
      deferred: 1,
    });
    expect(query.mock.calls.at(-1)?.[1]).toEqual([key, 60]);
    expect(query.mock.calls.some(([sql]) => sql.includes('DELETE FROM'))).toBe(
      false,
    );
  });

  it('caps exponential backoff at one hour', async () => {
    query.mockResolvedValueOnce([{ storage_key: key, cleanup_attempts: 99 }]);
    deleteFile.mockRejectedValueOnce(new Error('R2 unavailable'));
    await useCase.execute(key);
    expect(query.mock.calls.at(-1)?.[1]).toEqual([key, 3600]);
  });

  it('does not delete an object when database ownership cannot be checked', async () => {
    existsBy.mockRejectedValueOnce(new Error('DB unavailable'));
    await expect(useCase.execute(key)).resolves.toEqual({
      cleaned: 0,
      retained: 0,
      deferred: 1,
    });
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it('retains a grace-period tombstone for an uncertain PUT and repeats deletion later', async () => {
    await useCase.execute(key);
    expect(
      query.mock.calls.find(([sql]) => sql.includes('DELETE FROM'))?.[0],
    ).toContain('cleanup_after <= clock_timestamp()');
    expect(query.mock.calls.at(-1)?.[0]).toContain(
      'retry_after = cleanup_after',
    );
  });

  it('bounds each background batch to five objects', async () => {
    query.mockImplementation(async (sql: string) =>
      sql.includes('RETURNING')
        ? [{ storage_key: key, cleanup_attempts: 1 }]
        : [],
    );
    await expect(useCase.execute()).resolves.toEqual({
      cleaned: 5,
      retained: 0,
      deferred: 0,
    });
    expect(deleteFile).toHaveBeenCalledTimes(5);
    expect(query.mock.calls[0][0]).toContain(
      'retry_after <= clock_timestamp()',
    );
  });
});
