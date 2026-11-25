import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  agenticHash,
  agenticHex,
  agenticWellFormedText,
  type TeacherAgenticCommand,
  type TeacherAgenticReference,
} from '../../ai-generation/agentic-text-contract.js';
import type { AiSelection } from '../../ai-generation/ai-selection.js';
import { NodiaAiAdapterTransport } from '../../nodia-ai-adapter/nodia-ai-adapter.service.js';
import { CvTailoringError, type PreparedCvTailoring } from '../engine/types.js';
import { cvGenerationPrompt } from '../policies/nodia-cv-generation.js';
import {
  CV_AGENTIC_CONTRACT,
  cvAgenticPayloadHash,
} from './nodia-cv-agentic-contract.js';
import {
  CV_GEMINI_PROMPT_BYTES,
  cvGeminiRecord,
  cvGeminiResourceKey,
  invalidCvGeminiProtocol,
  parseCvGeminiDescriptor,
  parseCvGeminiReceipt,
  type CvGeminiDescriptor,
  type CvGeminiReceipt,
} from './nodia-cv-agentic-provider.js';

const path = '/cv/agentic-text';

type CvGeminiReference = Omit<TeacherAgenticReference, 'contract'> & {
  contract: typeof CV_AGENTIC_CONTRACT;
  owner_digest: string;
};

export type CvGeminiCommand = CvGeminiReference &
  Pick<TeacherAgenticCommand, 'prompt' | 'deadline_at'>;

export type CvGeminiSnapshot =
  | { state: 'running' }
  | { state: 'terminal'; receipt: CvGeminiReceipt; text: string | null };

export interface CvGeminiObservation {
  available: boolean;
  reason: string | null;
  observedAt: string;
  resourceKey: string | null;
  sessionGeneration: string;
  runtimeHash: string;
  policyHash: string;
  binarySha512: string | null;
}

function normalizedInstant(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(
      value,
    ) ||
    !Number.isFinite(Date.parse(value))
  )
    invalidCvGeminiProtocol();
  return new Date(value).toISOString();
}

function reference(
  descriptor: CvGeminiDescriptor,
  requestHash: string,
): CvGeminiReference {
  const d = parseCvGeminiDescriptor(descriptor);
  if (!agenticHex(requestHash)) invalidCvGeminiProtocol();
  return {
    contract: CV_AGENTIC_CONTRACT,
    operation_id: d.generation_id,
    session_id: d.generation_id,
    job_id: d.generation_id,
    attempt_id: d.attempt_id,
    actor_id: d.actor_id,
    connection_id: d.connection_id,
    model_id: d.model_id,
    effort_id: d.effort_id,
    resource_key: d.resource_key,
    configuration_generation: d.configuration_generation,
    session_generation: d.session_generation,
    runtime_hash: d.runtime_hash,
    policy_hash: d.policy_hash,
    owner_digest: agenticHash(d),
    request_hash: requestHash,
  };
}

function parseObservation(value: unknown): CvGeminiObservation {
  const v = cvGeminiRecord(value, [
    'contract',
    'available',
    'reason',
    'observed_at',
    'resource_key',
    'session_generation',
    'runtime_hash',
    'binary_sha512',
    'policy_hash',
    'tool_policy',
    'native_io',
  ]);
  const {
    available,
    reason,
    resource_key,
    session_generation,
    runtime_hash,
    policy_hash,
    binary_sha512,
  } = v;
  if (
    v.contract !== CV_AGENTIC_CONTRACT ||
    typeof available !== 'boolean' ||
    v.tool_policy !== 'finish_only' ||
    v.native_io !== false ||
    !(
      reason === null ||
      (typeof reason === 'string' && /^[a-z_]{1,100}$/.test(reason))
    ) ||
    !(resource_key === null || cvGeminiResourceKey(resource_key)) ||
    !agenticHex(session_generation, 32) ||
    !agenticHex(runtime_hash) ||
    !agenticHex(policy_hash) ||
    !(binary_sha512 === null || agenticHex(binary_sha512, 128)) ||
    (available
      ? reason !== null || !resource_key || !binary_sha512
      : reason === null)
  )
    invalidCvGeminiProtocol();
  return {
    available,
    reason,
    observedAt: normalizedInstant(v.observed_at),
    resourceKey: resource_key,
    sessionGeneration: session_generation,
    runtimeHash: runtime_hash,
    policyHash: policy_hash,
    binarySha512: binary_sha512,
  };
}

function parseSnapshot(
  value: unknown,
  expected: CvGeminiReference,
  descriptor: CvGeminiDescriptor,
): CvGeminiSnapshot {
  const v = cvGeminiRecord(value, [
    'contract',
    'operation_id',
    'state',
    'text',
    'terminal_proof',
  ]);
  if (
    v.contract !== CV_AGENTIC_CONTRACT ||
    v.operation_id !== expected.operation_id
  )
    invalidCvGeminiProtocol();
  if (v.state === 'running' && v.text === null && v.terminal_proof === null)
    return { state: 'running' };
  if (
    (v.state !== 'completed' && v.state !== 'unknown') ||
    !(
      v.text === null ||
      (v.state === 'completed' && typeof v.text === 'string')
    )
  )
    invalidCvGeminiProtocol();
  const proof = cvGeminiRecord(v.terminal_proof, [
    ...Object.keys(expected),
    'terminal_proof_id',
    'process_closed',
    'remote_outcome',
    'response_hash',
    'observed_at',
  ]);
  if (
    Object.entries(expected).some(([key, val]) => proof[key] !== val) ||
    proof.remote_outcome !== v.state
  )
    invalidCvGeminiProtocol();
  const { terminal_proof_id, process_closed, remote_outcome, response_hash } =
    proof;
  const receipt = parseCvGeminiReceipt(
    {
      ...descriptor,
      terminal_proof_id,
      process_closed,
      remote_outcome,
      response_hash,
      observed_at: normalizedInstant(proof.observed_at),
    },
    descriptor,
    v.text ?? undefined,
  );
  return { state: 'terminal', receipt, text: v.text };
}

function dispatchExclusion(
  value: unknown,
  status: number,
  expected: CvGeminiReference,
): string | null {
  if (status < 400 || status >= 500) return null;
  try {
    const v = cvGeminiRecord(value, [
      'code',
      'detail',
      'dispatch_exclusion_proof',
    ]);
    if (
      typeof v.code !== 'string' ||
      !/^[a-z_]{1,100}$/.test(v.code) ||
      typeof v.detail !== 'string' ||
      Buffer.byteLength(v.detail) > 4096
    )
      return null;
    const p = cvGeminiRecord(v.dispatch_exclusion_proof, [
      'contract',
      'operation_id',
      'request_hash',
      'session_generation',
      'runtime_hash',
      'process_started',
      'provider_started',
      'dispatch_exclusion',
      'observed_at',
    ]);
    return p.contract === CV_AGENTIC_CONTRACT &&
      p.operation_id === expected.operation_id &&
      p.request_hash === expected.request_hash &&
      p.session_generation === expected.session_generation &&
      p.runtime_hash === expected.runtime_hash &&
      p.process_started === false &&
      p.provider_started === false &&
      p.dispatch_exclusion === true
      ? normalizedInstant(p.observed_at)
      : null;
  } catch {
    return null;
  }
}

/** Private finish-only Gemini transport. No start retries or alternative modes. */
@Injectable()
export class NodiaCvGeminiTransport {
  constructor(private readonly adapter: NodiaAiAdapterTransport) {}

  async observe(
    selection: AiSelection,
    configurationGeneration: string,
    signal: AbortSignal,
  ) {
    if (selection.mode !== 'agentic' || !agenticHex(configurationGeneration))
      invalidCvGeminiProtocol();
    return parseObservation(
      await this.adapter.request(
        path + '/observe',
        {
          contract: CV_AGENTIC_CONTRACT,
          model_id: selection.model_id,
          effort_id: selection.effort_id,
          configuration_generation: configurationGeneration,
        },
        signal,
      ),
    );
  }

  prepare(
    descriptor: CvGeminiDescriptor,
    prepared: PreparedCvTailoring,
    deadlineAt: Date,
  ): CvGeminiCommand {
    const prompt = cvGenerationPrompt(prepared);
    if (Buffer.byteLength(prompt, 'utf8') > CV_GEMINI_PROMPT_BYTES)
      throw new CvTailoringError('input_too_large');
    if (
      !agenticWellFormedText(prompt) ||
      !prompt.trim() ||
      descriptor.payload_hash !== cvAgenticPayloadHash(prepared)
    )
      invalidCvGeminiProtocol();
    const { request_hash: _placeholder, ...ref } = reference(
      descriptor,
      descriptor.payload_hash,
    );
    const body = { ...ref, prompt, deadline_at: deadlineAt.toISOString() };
    return { ...body, request_hash: agenticHash(body) };
  }

  async start(
    command: CvGeminiCommand,
    descriptor: CvGeminiDescriptor,
    signal: AbortSignal,
  ) {
    const { request_hash, prompt, deadline_at, ...actual } = command;
    const expected = reference(descriptor, request_hash);
    if (
      agenticHash({ ...actual, request_hash }) !== agenticHash(expected) ||
      request_hash !== agenticHash({ ...actual, prompt, deadline_at })
    )
      invalidCvGeminiProtocol();
    let excludedAt: string | null = null;
    try {
      const raw = await this.adapter.request(
        path + '/start',
        command,
        signal,
        true,
        (body, status) => {
          excludedAt = dispatchExclusion(body, status, expected);
        },
      );
      return parseSnapshot(raw, expected, descriptor);
    } catch (error) {
      if (excludedAt === null) throw error;
      const receipt = parseCvGeminiReceipt(
        {
          ...descriptor,
          terminal_proof_id: randomUUID(),
          process_closed: true,
          observed_at: excludedAt,
          remote_outcome: 'not_dispatched',
          response_hash: null,
        },
        descriptor,
      );
      return { state: 'terminal', receipt, text: null } as const;
    }
  }

  status(
    descriptor: CvGeminiDescriptor,
    requestHash: string,
    signal: AbortSignal,
  ) {
    return this.read('/status', descriptor, requestHash, signal);
  }

  reconcile(
    descriptor: CvGeminiDescriptor,
    requestHash: string,
    signal: AbortSignal,
  ) {
    return this.read('/reconcile', descriptor, requestHash, signal);
  }

  private async read(
    route: '/status' | '/reconcile',
    descriptor: CvGeminiDescriptor,
    requestHash: string,
    signal: AbortSignal,
  ) {
    const expected = reference(descriptor, requestHash);
    return parseSnapshot(
      await this.adapter.request(path + route, expected, signal),
      expected,
      descriptor,
    );
  }

  async acknowledge(
    descriptor: CvGeminiDescriptor,
    requestHash: string,
    candidate: CvGeminiReceipt,
    signal: AbortSignal,
  ) {
    const receipt = parseCvGeminiReceipt(candidate, descriptor);
    if (receipt.remote_outcome === 'not_dispatched') invalidCvGeminiProtocol();
    const raw = await this.adapter.request(
      path + '/ack',
      {
        ...reference(descriptor, requestHash),
        terminal_proof_id: receipt.terminal_proof_id,
        response_hash: receipt.response_hash,
      },
      signal,
    );
    if (cvGeminiRecord(raw, ['acknowledged']).acknowledged !== true)
      invalidCvGeminiProtocol();
  }
}
