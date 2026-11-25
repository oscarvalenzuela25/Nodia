import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { addAbortListener } from 'node:events';
import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import type { AiSelection } from '../../ai-generation/ai-selection.js';
import {
  agenticHash,
  agenticTextHash,
} from '../../ai-generation/agentic-text-contract.js';
import {
  codexTeacherEnvironment,
  codexTeacherHostMetadata,
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
import {
  CV_AGENTIC_POLICY_VERSION,
  cvAgenticPayloadHash,
  parseCvAgenticDescriptor,
  parseCvAgenticReceipt,
  type CvAgenticDescriptor,
  type CvAgenticReceipt,
} from './nodia-cv-agentic-contract.js';
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
  'metadata' | 'acquire' | 'spawn' | 'identity' | 'stop'
> {
  assertEmpty(group: number): Promise<void>;
}

const nativePorts: CvCodexNativePorts = {
  metadata: codexTeacherHostMetadata,
  acquire: (connection, signal) =>
    acquireCodexProfileLease(connection, true, signal, true),
  identity: codexProcessIdentity,
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
  /** Persist the native identity and single exchange. Return false only when no admission was written. */
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
  /** The owner durably records the terminal and ACK before the native profile is released. */
  terminal(outcome: CvCodexExecution): Promise<void>;
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
  constructor(
    private readonly selection: Pick<NodiaCvCodexSelection, 'observe'>,
    private readonly runtime: Pick<CodexRuntimeService, 'releaseIdle'>,
    private readonly journal: Pick<CodexChatRuntime['journal'], 'identity'>,
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
      const host = await this.ports.metadata(signal);
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
    } catch {
      signal.throwIfAborted();
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
        prompt: `${systemPrompt}\n\nInput JSON:\n${userPrompt}`,
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
      transport.host.path,
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
    path: string,
    observation: CvCodexSelectionReady,
    lease: CodexProfileLease,
    wire: HostWire,
    barrier: CvCodexExecutionBarrier,
    signal: AbortSignal,
  ): Promise<CvCodexExecution> {
    let child: ChildProcessWithoutNullStreams | undefined;
    let native: CodexProcessIdentity | undefined;
    let releasedInput = false;
    let admission: 'not_admitted' | 'unverified' | 'admitted' = 'not_admitted';
    let outcome = noDispatch;
    try {
      const actual = await this.journal.identity(
        descriptor.connection_id,
        false,
        false,
      );
      if (!identityMatches(actual, descriptor))
        throw Error('cv:codex_session_changed');
      const owner = await this.ports.identity(process.pid);
      signal.throwIfAborted();
      child = this.ports.spawn(
        path,
        [
          '--config-json',
          JSON.stringify(hostSettings()),
          '--workspace',
          lease.cwd,
        ],
        {
          cwd: lease.cwd,
          env: codexTeacherEnvironment(lease.profilePath),
          detached: true,
          shell: false,
        },
      );
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
      await lease.bindRuntime(child.pid, native);
      signal.throwIfAborted();
      admission = 'unverified';
      const accepted = await barrier.arm(
        {
          descriptor,
          observation,
          owner,
          native,
          workspace: basename(lease.cwd),
        },
        signal,
      );
      admission = accepted ? 'admitted' : 'not_admitted';
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
    } catch {
      // Leave the persisted identity and the profile barrier for reconciliation.
      throw Error('cv:codex_close_unverified');
    }
    if (admission === 'unverified')
      throw Error('cv:codex_admission_unverified');
    if (admission === 'not_admitted') {
      await lease.release();
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
    await lease.release();
    return result;
  }
}
