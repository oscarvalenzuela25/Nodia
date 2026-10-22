export interface NodiaAiBackupEntry {
  backup_id: string;
  object_key: string;
  captured_at: string;
  expires_at: string;
  encryption_key_id: string;
  status: 'pending' | 'ready' | 'deleting';
  cipher_bytes: number | null;
  cipher_sha256: string | null;
  journal_sequence: number;
  journal_sha256: string;
}

export interface NodiaAiBackupReceipt { cipher_bytes: number; cipher_sha256: string }
export interface NodiaAiBackupObservation extends NodiaAiBackupReceipt {
  backup_id: string;
  encryption_key_id: string;
  etag: string;
  version_id: string | null;
}

/** mutate must merge with the current external journal using short CAS retries.
 * Its synchronous callback can run more than once; never perform effects inside it. */
export interface NodiaAiBackupCatalog {
  read(): Promise<NodiaAiBackupEntry[]>;
  mutate(update: (current: NodiaAiBackupEntry[]) => NodiaAiBackupEntry[]): Promise<void>;
  checkpoint(): Promise<{ sequence: number; sha256: string; coverage_from: string }>;
}

export interface NodiaAiBackupPorts {
  catalog: NodiaAiBackupCatalog;
  now(): Date;
  /** An encrypted-only bounded spool. No cloud PUT until the expected receipt is durable. */
  prepare(entry: NodiaAiBackupEntry, signal: AbortSignal): Promise<NodiaAiBackupReceipt>;
  upload(entry: NodiaAiBackupEntry, signal: AbortSignal): Promise<void>;
  /** HEAD followed by bounded GET digest; no listing or guessed prefix. */
  inspect(entry: NodiaAiBackupEntry, signal: AbortSignal): Promise<NodiaAiBackupObservation | null>;
  /** Delete an exclusively owned immutable UUID key after positive digest verification.
   * R2 does not enforce DELETE If-Match in the real probe; versioned keys are rejected.
   * Never a prefix/bucket sweep or a claim of atomic conditional DELETE. */
  deleteExact(entry: NodiaAiBackupEntry, observed: NodiaAiBackupObservation, signal: AbortSignal): Promise<void>;
  cleanupSpool(entry: NodiaAiBackupEntry): Promise<void>;
}
