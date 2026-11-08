import { createHash, randomUUID } from 'node:crypto';
import type { ExtractedInvoiceData } from '../ai.types.js';
import type { CodexRuntimeService } from './codex-runtime.service.js';
import {
  CodexChatJournal,
  assertCodexChatIdentity,
  sameCodexChatIdentity,
  type CodexChatRecord,
} from './codex-chat-journal.js';
import {
  CodexChatAdmissionError,
  CodexChatRuntimeError,
  type CodexChatIdentity,
} from './codex-chat-contract.js';
import { codexProcessIdentity } from './codex-process-ownership.js';
import { codexError, CodexOperationException } from './codex-contract.js';
import type { CodexProtocolProgress } from './codex-rpc.js';
import type { NodiaAiRuntimeTerminalProof } from '../../../nodia-ai-runtime/types/reconciliation.types.js';
import { validateInvoiceFile } from '../../../invoice/invoice-file-validation.js';

export interface CodexNativeInvoiceRequest {
  readonly identity: CodexChatIdentity;
  readonly modelId: string;
  readonly effortId: string | null;
  readonly configurationGeneration: string;
  readonly file: Express.Multer.File;
  readonly fields?: Record<string, unknown>;
  readonly tax: number | null;
  readonly deadlineAt: Date;
  readonly signal: AbortSignal;
  readonly assertLease: (signal: AbortSignal) => Promise<void>;
}

/** Internal lifecycle of the single Products OCR core, never a second OCR engine. */
export interface CodexInvoiceLifecycle {
  readonly effortId: string | null;
  acquire(signal: AbortSignal): ReturnType<CodexRuntimeService['acquireChat']>;
  beforeDispatch(signal: AbortSignal): Promise<void>;
  validateResult(extraction: ExtractedInvoiceData): void;
  finish(completed: boolean): Promise<void>;
}

/** Shares the chat/1 journal so the existing reconcile/ACK ports retain authority. */
export async function executeNativeCodexInvoice(
  runtime: CodexRuntimeService,
  input: CodexNativeInvoiceRequest,
  executeCore: (
    lifecycle: CodexInvoiceLifecycle,
    signal: AbortSignal,
  ) => Promise<ExtractedInvoiceData>,
  journal = new CodexChatJournal(),
): Promise<{
  extraction: ExtractedInvoiceData;
  terminalProof: NodiaAiRuntimeTerminalProof;
}> {
  assertCodexChatIdentity(input.identity);
  validateInvoiceFile(input.file);
  if (
    !/^[a-f0-9]{64}$/.test(input.configurationGeneration) ||
    typeof input.modelId !== 'string' ||
    !input.modelId.trim() ||
    input.modelId.length > 128 ||
    (input.effortId !== null &&
      (typeof input.effortId !== 'string' ||
        !/^[a-z][a-z0-9_-]{0,31}$/.test(input.effortId))) ||
    (input.tax !== null &&
      (typeof input.tax !== 'number' ||
        !Number.isFinite(input.tax) ||
        input.tax < 0 ||
        input.tax > 100))
  )
    throw codexError('codex_protocol_invalid', 502);
  const identity = structuredClone(input.identity);
  const connectionId = identity.adapterIdentity.connectionId;
  const remaining = input.deadlineAt.getTime() - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0 || remaining > 120000)
    throw codexError('codex_timeout', 504);
  const metadata = JSON.stringify({
    modelId: input.modelId,
    effortId: input.effortId,
    configurationGeneration: input.configurationGeneration,
    fields: input.fields ?? null,
    tax: input.tax,
    mediaType: input.file.mimetype,
    byteCount: input.file.buffer.length,
    sourceSha256: createHash('sha256').update(input.file.buffer).digest('hex'),
  });
  if (Buffer.byteLength(metadata) > 64 * 1024)
    throw codexError('codex_protocol_invalid', 502);
  const controller = new AbortController();
  const signal = AbortSignal.any([
    input.signal,
    controller.signal,
    AbortSignal.timeout(Math.max(1, remaining)),
  ]);
  signal.throwIfAborted();
  const current = await journal.identity(connectionId);
  if (
    current.resourceKey !== identity.resourceKey ||
    current.runtimeSessionId !== identity.sessionGeneration
  )
    throw codexError('codex_request_conflict', 409);
  await input.assertLease(signal);
  signal.throwIfAborted();
  let record: CodexChatRecord = {
    version: 1,
    identity,
    expiresAt: input.deadlineAt.toISOString(),
    owner: await codexProcessIdentity(process.pid),
    native: null,
    state: 'reserved',
    payloadSha256: createHash('sha256').update(metadata).digest('hex'),
    rpcCount: 0,
    frames: 0,
    bytes: 0,
    unforwardedRequests: 0,
    cancelRequested: false,
    terminalProofId: null,
    observedAt: null,
    acknowledged: false,
  };
  // Exact payload accepted: every subsequent core failure is reconciled, never replayed.
  await journal.reserve(record);
  let acquired = false,
    acquisitionAttempted = false,
    admissionClosed = false,
    finalized = false;
  let detach: (() => Promise<void>) | undefined;
  let latest: CodexProtocolProgress | undefined;
  let poll: NodeJS.Timeout | undefined;
  let polling: Promise<void> | undefined;
  const update = (work: (value: CodexChatRecord) => void) =>
    journal.locked(identity.attemptId, async () => {
      const value = await journal.read(identity.attemptId);
      if (
        !value ||
        !sameCodexChatIdentity(value.identity, identity) ||
        value.acknowledged
      )
        throw codexError('codex_login_unknown', 409);
      work(value);
      await journal.write(value);
      record = value;
    });
  const lifecycle: CodexInvoiceLifecycle = {
    effortId: input.effortId,
    acquire: async (ownedSignal) => {
      acquisitionAttempted = true;
      try {
        const lease = await runtime.acquireChat(
          connectionId,
          ownedSignal,
          async (native, rpc) => {
            await input.assertLease(ownedSignal);
            await update((value) => {
              if (value.state !== 'reserved' || value.native)
                throw codexError('codex_request_conflict', 409);
              value.native = native;
              value.state = 'prepared';
            });
            detach = rpc.observeProtocol(async (progress) => {
              latest = { ...progress };
              if (
                progress.overflow ||
                progress.frames > 10000 ||
                progress.bytes > 16 * 1024 * 1024
              )
                throw codexError('codex_protocol_invalid', 502);
              if (
                progress.requests !== record.rpcCount ||
                progress.unforwardedRequests !== record.unforwardedRequests
              )
                await update((value) => {
                  if (
                    progress.frames < value.frames ||
                    progress.bytes < value.bytes ||
                    progress.requests < value.rpcCount ||
                    progress.unforwardedRequests < value.unforwardedRequests
                  )
                    throw codexError('codex_protocol_invalid', 502);
                  value.frames = progress.frames;
                  value.bytes = progress.bytes;
                  value.rpcCount = progress.requests;
                  value.unforwardedRequests = progress.unforwardedRequests;
                });
            });
          },
        );
        acquired = true;
        // Existing reconciler records cancellation; this owner alone closes its process.
        poll = setInterval(() => {
          if (polling || signal.aborted) return;
          polling = journal
            .read(identity.attemptId)
            .then((value) => {
              if (
                !value ||
                !sameCodexChatIdentity(value.identity, identity) ||
                value.cancelRequested
              )
                controller.abort(codexError('codex_cancelled', 499));
            })
            .catch(() =>
              controller.abort(codexError('codex_login_unknown', 409)),
            )
            .finally(() => {
              polling = undefined;
            });
        }, 200).unref();
        return lease;
      } catch (error) {
        admissionClosed = error instanceof CodexChatAdmissionError;
        throw error;
      }
    },
    beforeDispatch: async (ownedSignal) => {
      await input.assertLease(ownedSignal);
      ownedSignal.throwIfAborted();
      const actual = await journal.identity(connectionId, false, false);
      if (
        actual.resourceKey !== identity.resourceKey ||
        actual.runtimeSessionId !== identity.sessionGeneration
      )
        throw codexError('codex_request_conflict', 409);
      await update((value) => {
        if (value.state !== 'prepared' || value.cancelRequested)
          throw codexError('codex_cancelled', 499);
        value.state = 'submitted';
      });
      ownedSignal.throwIfAborted();
    },
    validateResult: (extraction) => {
      const preview = {
        extraction,
        terminalProof: {
          ...identity,
          terminalProofId: '00000000-0000-0000-0000-000000000000',
          processClosed: true,
          outcome: 'completed',
          observedAt: new Date(),
        },
      };
      if (Buffer.byteLength(JSON.stringify(preview)) > 64 * 1024)
        throw codexError('codex_protocol_invalid', 502);
    },
    finish: async (completed) => {
      if (finalized) return;
      clearInterval(poll);
      await polling;
      if (acquired) await runtime.stop(connectionId);
      else if (acquisitionAttempted && !admissionClosed) return; // No closure certificate: retain pending receipt.
      await detach?.();
      await update((value) => {
        if (latest) {
          value.frames = latest.frames;
          value.bytes = latest.bytes;
          value.rpcCount = latest.requests;
          value.unforwardedRequests = latest.unforwardedRequests;
        }
        value.state =
          completed && value.state === 'submitted'
            ? 'completed'
            : 'abandoned_unknown';
        value.terminalProofId = randomUUID();
        value.observedAt = new Date().toISOString();
      });
      finalized = true;
    },
  };
  try {
    const extraction = await executeCore(lifecycle, signal);
    if (!finalized || record.state !== 'completed')
      throw codexError('codex_login_unknown', 409);
    const reply = { extraction, terminalProof: journal.proof(record) };
    if (Buffer.byteLength(JSON.stringify(reply)) > 64 * 1024)
      throw codexError('codex_protocol_invalid', 502);
    return reply;
  } catch (error) {
    // Core validation may fail before acquiring; it still has an exact accepted
    // receipt. Failure to close/write never produces a fabricated terminal proof.
    try {
      await lifecycle.finish(false);
    } catch {
      /* Pending journal remains authoritative. */
    }
    throw new CodexChatRuntimeError(
      error instanceof CodexOperationException ||
        error instanceof CodexChatAdmissionError
        ? error.code
        : 'codex_runtime_unavailable',
      'unknown',
    );
  } finally {
    clearInterval(poll);
  }
}
