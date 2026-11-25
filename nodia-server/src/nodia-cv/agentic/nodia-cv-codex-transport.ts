import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { addAbortListener } from 'node:events';
import { lstat, readFile, realpath, rm } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import type { AiSelection } from '../../ai-generation/ai-selection.js';
import {
  agenticHash,
  agenticTextHash,
} from '../../ai-generation/agentic-text-contract.js';
import {
  codexTeacherEnvironment,
  type CodexTeacherHostPorts,
} from '../../ai-generation/codex-teacher-text-transport.js';
import type { CodexChatRuntime } from '../../common/ai/codex/codex-chat-runtime.js';
import { CODEX_SETTINGS } from '../../common/ai/codex/codex-contract.js';
import {
  acquireCodexProfileLease,
  type CodexProfileLease,
} from '../../common/ai/codex/codex-profile-lease.js';
import {
  assertCodexGroupEmpty,
  codexProcessIdentity,
  sameCodexProcess,
  stopCodexGroup,
  type CodexProcessIdentity,
} from '../../common/ai/codex/codex-process-ownership.js';
import type { CodexRuntimeService } from '../../common/ai/codex/codex-runtime.service.js';
import {
  buildCvDraft,
  CvTailoringError,
  type CvTailoringDraft,
  type PreparedCvTailoring,
} from '../engine/index.js';
import { cvGenerationPrompt } from '../policies/nodia-cv-generation.js';
import type { CvAgenticCustody } from '../types/nodia-cv-generation.types.js';
import {
  CV_AGENTIC_POLICY_VERSION,
  cvAgenticPayloadHash,
  parseCvAgenticDescriptor,
  parseCvAgenticReceipt,
  type CvAgenticDescriptor,
  type CvAgenticReceipt,
} from './nodia-cv-agentic-contract.js';
import {
  CodexCvHostSelectionError,
  codexCvHostMetadata,
  type CodexCvHostMetadata,
} from './nodia-cv-codex-host.js';
import type {
  CvCodexSelectionReady,
  NodiaCvCodexSelection,
} from './nodia-cv-codex-selection.js';
import {
  createCvCodexHostWire,
  CV_CODEX_HOST_MAX_TERMINAL_FRAME_BYTES,
} from './nodia-cv-codex-wire.js';

type HostWire = ReturnType<typeof createCvCodexHostWire>;
type HostResult = ReturnType<HostWire['finish']>;
type ProfileIdentity = Pick<
  Awaited<ReturnType<CodexChatRuntime['journal']['identity']>>,
  'resourceKey' | 'runtimeSessionId'
>;

export interface CvCodexNativePorts extends Pick<
  CodexTeacherHostPorts,
  'acquire' | 'spawn' | 'identity' | 'stop' | 'same'
> {
  metadata: typeof codexCvHostMetadata;
  assertEmpty(group: number): Promise<void>;
}

const nativePorts: CvCodexNativePorts = {
  metadata: codexCvHostMetadata,
  acquire: (connection, signal) =>
    acquireCodexProfileLease(connection, true, signal, true),
  identity: codexProcessIdentity,
  same: sameCodexProcess,
  stop: stopCodexGroup,
  assertEmpty: assertCodexGroupEmpty,
  spawn: (path, args, options) =>
    spawn(path, args, { ...options, stdio: 'pipe' }),
};

export type CvCodexExecution =
  | { state: 'draft'; draft: CvTailoringDraft; receipt: CvAgenticReceipt }
  | {
      state: 'failed';
      code:
        | 'codex_not_dispatched'
        | 'codex_outcome_unknown'
        | CvTailoringError['code'];
      receipt: CvAgenticReceipt;
    };

export interface CvCodexExecutionBarrier {
  /** Persist ownership of the gated workspace before starting a native process. */
  bind(custody: CvAgenticCustody, signal: AbortSignal): Promise<boolean>;
  /** Persist the native identity, then check authority and consume one exchange before stdin. */
  arm(
    input: {
      descriptor: CvAgenticDescriptor;
      observation: CvCodexSelectionReady;
      owner: CodexProcessIdentity;
      native: CodexProcessIdentity;
      workspace: string;
    },
    signal: AbortSignal,
  ): Promise<boolean>;
  /** Persist the exact terminal before releasing the native profile. SQL ACK follows release. */
  terminal(outcome: CvCodexExecution): Promise<void>;
}

interface LocalCvLease {
  descriptor: CvAgenticDescriptor;
  lease: CodexProfileLease;
  active: boolean;
  closed: boolean;
  childPid?: number;
  native?: CodexProcessIdentity;
  releasing?: Promise<void>;
}

const identityMatches = (
  actual: ProfileIdentity,
  expected: CvAgenticDescriptor,
) =>
  actual.resourceKey === expected.resource_key &&
  actual.runtimeSessionId === expected.session_generation;

function hostSettings(): Record<string, unknown> {
  return {
    ...CODEX_SETTINGS,
    features: {
      ...(CODEX_SETTINGS.features as object),
      unbounded_connection_retries: false,
    },
  };
}

async function transportSourcesHash(): Promise<string> {
  const source = new URL(import.meta.url);
  const extension = extname(source.pathname);
  const paths = [
    source,
    new URL(`./nodia-cv-codex-wire${extension}`, source),
    new URL(`./nodia-cv-codex-host${extension}`, source),
    new URL(`./nodia-cv-agentic-contract${extension}`, source),
    new URL(`./nodia-cv-codex-selection${extension}`, source),
  ];
  const digests = await Promise.all(
    paths.map(async (path) =>
      createHash('sha256')
        .update(await readFile(path))
        .digest('hex'),
    ),
  );
  return agenticHash(digests);
}

const noDispatch: HostResult = { outcome: 'not_dispatched', text: null };
const unknown: HostResult = { outcome: 'unknown', text: null };

async function readHostOutput(
  child: ChildProcessWithoutNullStreams,
  wire: HostWire,
) {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let pending: Buffer = Buffer.alloc(0);
  for await (const data of child.stdout) {
    const chunk = Buffer.isBuffer(data)
      ? data
      : Buffer.from(data as Uint8Array);
    let start = 0;
    while (start < chunk.length) {
      const newline = chunk.indexOf(0x0a, start);
      const end = newline < 0 ? chunk.length : newline;
      const part = chunk.subarray(start, end);
      if (pending.length + part.length > CV_CODEX_HOST_MAX_TERMINAL_FRAME_BYTES)
        throw Error('cv:codex_invalid_host_output');
      pending = pending.length ? Buffer.concat([pending, part]) : part;
      if (newline < 0) break;
      if (wire.accept(decoder.decode(pending))) child.stdin.end();
      pending = Buffer.alloc(0);
      start = newline + 1;
    }
  }
  if (pending.length) throw Error('cv:codex_invalid_host_output');
  return wire.finish();
}

async function waitForHost(
  result: Promise<HostResult>,
  exit: Promise<number | null>,
  signal: AbortSignal,
): Promise<HostResult> {
  signal.throwIfAborted();
  let subscription: ReturnType<typeof addAbortListener> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    subscription = addAbortListener(signal, () =>
      reject(Error('cv:codex_interrupted')),
    );
  });
  try {
    const [outcome, code] = await Promise.race([
      Promise.all([result, exit]),
      timeout,
    ]);
    return (outcome.outcome === 'completed' ? code === 0 : code === 1)
      ? outcome
      : unknown;
  } finally {
    subscription?.[Symbol.dispose]();
  }
}

/** This host has no tool registry, environments, attachments, continuation or transport retries. */
export class NodiaCvCodexTransport {
  private readonly leases = new Map<string, LocalCvLease>();

  constructor(
    private readonly selection: Pick<NodiaCvCodexSelection, 'observe'>,
    private readonly runtime: Pick<
      CodexRuntimeService,
      'releaseIdle' | 'recoverClosedProfile'
    >,
    private readonly journal: Pick<
      CodexChatRuntime['journal'],
      'identity' | 'root'
    >,
    private readonly ports: CvCodexNativePorts = nativePorts,
  ) {}

  async observe(selection: AiSelection, signal: AbortSignal) {
    const observed = await this.selection.observe(selection, signal);
    if (observed.status !== 'metadata_ready')
      return {
        selection: observed,
        transport: { status: 'unobserved' },
      } as const;
    try {
      const host = await this.ports.metadata(signal, observed.selection);
      const sources = await transportSourcesHash();
      signal.throwIfAborted();
      const policyHash = agenticHash({
        version: CV_AGENTIC_POLICY_VERSION,
        host: host.capabilities.policy_hash,
      });
      const runtimeHash = agenticHash({
        host: host.runtimeHash,
        policyHash,
        sources,
      });
      return {
        selection: observed,
        transport: { status: 'available', host, policyHash, runtimeHash },
      } as const;
    } catch (error) {
      signal.throwIfAborted();
      if (error instanceof CodexCvHostSelectionError)
        return {
          selection: observed,
          transport: { status: 'selection_unsupported', reason: error.reason },
        } as const;
      return {
        selection: observed,
        transport: { status: 'host_unavailable' },
      } as const;
    }
  }

  async execute(
    input: {
      descriptor: CvAgenticDescriptor;
      prepared: PreparedCvTailoring;
      deadlineAt: Date;
      signal: AbortSignal;
    },
    barrier: CvCodexExecutionBarrier,
  ): Promise<CvCodexExecution> {
    const descriptor = parseCvAgenticDescriptor(input.descriptor);
    const prepared = structuredClone(input.prepared);
    const { systemPrompt, userPrompt, promptVersion, schemaVersion } = prepared;
    if (
      descriptor.payload_hash !==
        cvAgenticPayloadHash({ systemPrompt, userPrompt }) ||
      descriptor.prompt_version !== promptVersion ||
      descriptor.schema_version !== schemaVersion
    )
      throw Error('cv:codex_payload_mismatch');
    const deadline = new Date(input.deadlineAt.getTime());
    const remaining = deadline.getTime() - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0 || remaining > 600_000)
      throw Error('cv:codex_deadline_invalid');
    const signal = AbortSignal.any([
      input.signal,
      AbortSignal.timeout(remaining),
    ]);
    const current = await this.observe(
      {
        connection_id: descriptor.connection_id,
        mode: descriptor.mode,
        model_id: descriptor.model_id,
        effort_id: descriptor.effort_id,
      },
      signal,
    );
    const selected = current.selection,
      transport = current.transport;
    if (
      selected.status !== 'metadata_ready' ||
      transport.status !== 'available' ||
      selected.selection.connection_id !== descriptor.connection_id ||
      selected.selection.model_id !== descriptor.model_id ||
      selected.selection.effort_id !== descriptor.effort_id ||
      selected.configurationGeneration !==
        descriptor.configuration_generation ||
      !identityMatches(
        {
          resourceKey: selected.resourceKey,
          runtimeSessionId: selected.sessionGeneration,
        },
        descriptor,
      ) ||
      transport.policyHash !== descriptor.policy_hash ||
      transport.runtimeHash !== descriptor.runtime_hash
    )
      throw Error('cv:codex_selection_changed');
    const wire = createCvCodexHostWire(
      {
        operation_id: descriptor.attempt_id,
        model_id: descriptor.model_id,
        effort_id: descriptor.effort_id,
        prompt: cvGenerationPrompt(prepared),
        deadline_at: deadline.toISOString(),
        configuration_generation: descriptor.configuration_generation,
        session_generation: descriptor.session_generation,
        resource_key: descriptor.resource_key,
      },
      transport.host.capabilities.policy_hash,
      transport.host.capabilities.source_commit,
    );
    await this.runtime.releaseIdle(descriptor.connection_id);
    const lease = await this.ports.acquire(descriptor.connection_id, signal);
    return this.run(
      descriptor,
      prepared,
      transport.host,
      selected,
      lease,
      wire,
      barrier,
      signal,
    );
  }

  private async run(
    descriptor: CvAgenticDescriptor,
    prepared: PreparedCvTailoring,
    host: CodexCvHostMetadata,
    observation: CvCodexSelectionReady,
    lease: CodexProfileLease,
    wire: HostWire,
    barrier: CvCodexExecutionBarrier,
    signal: AbortSignal,
  ): Promise<CvCodexExecution> {
    let child: ChildProcessWithoutNullStreams | undefined;
    let native: CodexProcessIdentity | undefined;
    let releasedInput = false;
    let custody: 'unbound' | 'uncertain' | 'bound' = 'unbound';
    let outcome = noDispatch;
    const owned: LocalCvLease = {
      descriptor,
      lease,
      active: true,
      closed: false,
    };
    this.leases.set(descriptor.attempt_id, owned);
    try {
      const actual = await this.journal.identity(
        descriptor.connection_id,
        false,
        false,
      );
      if (!identityMatches(actual, descriptor))
        throw Error('cv:codex_session_changed');
      const owner = await this.ports.identity(process.pid);
      const workspace = basename(lease.cwd);
      custody = 'uncertain';
      if (!(await barrier.bind({ owner, native: null, workspace }, signal))) {
        custody = 'unbound';
        throw Error('cv:codex_preflight_failed');
      }
      custody = 'bound';
      signal.throwIfAborted();
      child = this.ports.spawn(
        host.path,
        [
          '--config-json',
          JSON.stringify(hostSettings()),
          '--workspace',
          lease.cwd,
          '--model-metadata-json',
          host.modelMetadata,
        ],
        {
          cwd: lease.cwd,
          env: codexTeacherEnvironment(lease.profilePath),
          detached: true,
          shell: false,
        },
      );
      owned.childPid = child.pid;
      const exit = new Promise<number | null>((resolve) => {
        child?.once('close', resolve);
        child?.once('error', () => resolve(null));
      });
      child.stdin.on('error', () => undefined);
      child.stderr.resume();
      const output = readHostOutput(child, wire);
      void output.catch(() => undefined);
      if (!child.pid) throw Error('cv:codex_spawn_failed');
      const observedNative = await this.ports.identity(child.pid);
      if (
        observedNative.pid !== child.pid ||
        observedNative.group !== child.pid
      )
        throw Error('cv:codex_native_identity_unverified');
      native = observedNative;
      owned.native = native;
      await lease.bindRuntime(child.pid, native);
      const accepted = await barrier.arm(
        {
          descriptor,
          observation,
          owner,
          native,
          workspace,
        },
        signal,
      );
      if (accepted) {
        signal.throwIfAborted();
        releasedInput = true;
        child.stdin.write(wire.input);
        outcome = await waitForHost(output, exit, signal);
        if (signal.aborted) outcome = unknown;
      }
    } catch {
      if (releasedInput) outcome = unknown;
    }

    if (!releasedInput) child?.stdin.end();
    try {
      if (native)
        await this.ports.stop(
          native,
          !releasedInput || outcome.outcome === 'unknown',
        );
      else if (child?.pid) await this.ports.assertEmpty(child.pid);
      owned.closed = true;
    } catch {
      // Leave the persisted identity and the profile barrier for reconciliation.
      throw Error('cv:codex_close_unverified');
    } finally {
      owned.active = false;
    }
    if (custody === 'uncertain') throw Error('cv:codex_admission_unverified');
    if (custody === 'unbound') {
      await this.releaseLocal(owned);
      throw Error('cv:codex_preflight_failed');
    }
    const receipt = parseCvAgenticReceipt(
      {
        ...descriptor,
        terminal_proof_id: randomUUID(),
        process_closed: true,
        remote_outcome: outcome.outcome,
        response_hash:
          outcome.text === null ? null : agenticTextHash(outcome.text),
        observed_at: new Date().toISOString(),
      },
      descriptor,
      outcome.text ?? undefined,
    );
    let result: CvCodexExecution;
    if (outcome.text === null) {
      result = {
        state: 'failed',
        code:
          outcome.outcome === 'unknown'
            ? 'codex_outcome_unknown'
            : 'codex_not_dispatched',
        receipt,
      };
    } else {
      try {
        result = {
          state: 'draft',
          draft: buildCvDraft(prepared, outcome.text),
          receipt,
        };
      } catch (error) {
        if (!(error instanceof CvTailoringError)) throw error;
        result = { state: 'failed', code: error.code, receipt };
      }
    }
    await barrier.terminal(result);
    await this.releaseLocal(owned);
    return result;
  }

  private localLease(descriptor: CvAgenticDescriptor) {
    const owned = this.leases.get(descriptor.attempt_id);
    if (owned && agenticHash(owned.descriptor) !== agenticHash(descriptor))
      throw Error('cv:codex_attempt_mismatch');
    return owned;
  }

  private async releaseLocal(owned: LocalCvLease) {
    if (!owned.closed) throw Error('cv:codex_close_unverified');
    owned.releasing ??= owned.lease
      .release()
      .then(() => {
        this.leases.delete(owned.descriptor.attempt_id);
      })
      .catch((error: unknown) => {
        owned.releasing = undefined;
        throw error;
      });
    await owned.releasing;
  }

  private async profileLock(descriptor: CvAgenticDescriptor) {
    const actual = await this.journal.identity(
      descriptor.connection_id,
      false,
      false,
    );
    if (actual.resourceKey !== descriptor.resource_key)
      throw Error('cv:codex_resource_mismatch');
    const root = dirname(await this.journal.root());
    const file = join(root, descriptor.connection_id, 'nodia.lock');
    const exists = await lstat(file).then(
      () => true,
      (error: unknown) => {
        if (missingPath(error)) return false;
        throw error;
      },
    );
    return { root, exists };
  }

  /** Check the original process group. A restored SQL row alone is insufficient evidence. */
  async provenClosed(
    descriptor: CvAgenticDescriptor,
    custody: CvAgenticCustody | null,
  ) {
    const local = this.localLease(descriptor);
    if (local) {
      if (local.active) return false;
      if (!local.closed) {
        if (local.native) await this.ports.stop(local.native, false);
        else if (local.childPid) await this.ports.assertEmpty(local.childPid);
        local.closed = true;
      }
      return true;
    }
    const lock = await this.profileLock(descriptor);
    if (!custody?.native) return !lock.exists;
    const identity = await this.ports.identity(process.pid);
    if (
      custody.owner.boot !== identity.boot ||
      custody.native.boot !== identity.boot
    )
      return false;
    if (lock.exists && (await this.ports.same(custody.owner))) return false;
    await this.ports.stop(custody.native, false);
    return true;
  }

  /** Only call after PostgreSQL durably records the terminal. */
  async releaseClosed(
    descriptor: CvAgenticDescriptor,
    custody: CvAgenticCustody | null,
  ) {
    const local = this.localLease(descriptor);
    if (local) {
      await this.releaseLocal(local);
      return;
    }
    const lock = await this.profileLock(descriptor);
    if (custody?.native) {
      if (!(await this.provenClosed(descriptor, custody)))
        throw Error('cv:codex_close_unverified');
      if (lock.exists)
        await this.runtime.recoverClosedProfile(
          descriptor.connection_id,
          custody.owner,
          custody.native,
        );
    } else if (lock.exists) {
      throw Error('cv:codex_close_unverified');
    }
    if (custody) await this.removeWorkspace(lock.root, custody.workspace);
  }

  private async removeWorkspace(root: string, workspace: string) {
    if (!/^teacher-work-[A-Za-z0-9]{6}$/.test(workspace))
      throw Error('cv:codex_workspace_unverified');
    const path = join(root, workspace);
    const info = await lstat(path).catch((error: unknown) => {
      if (missingPath(error)) return null;
      throw error;
    });
    if (!info) return;
    if (
      !info.isDirectory() ||
      info.uid !== process.getuid?.() ||
      (await realpath(path)) !== path
    )
      throw Error('cv:codex_workspace_unverified');
    await rm(path, { recursive: true });
  }
}

function missingPath(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}
