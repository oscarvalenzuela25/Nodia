import { Injectable } from '@nestjs/common';
import { NodiaAiAdapterTransport } from '../nodia-ai-adapter/nodia-ai-adapter.service.js';
import type { AiSelection } from './ai-selection.js';
import {
  TEACHER_AGENTIC_CONTRACT, TeacherAgenticClosedError, parseTeacherAgenticObservation, parseTeacherAgenticSnapshot,
  parseTeacherAgenticProof,
  type TeacherAgenticCommand, type TeacherAgenticReference, type TeacherAgenticProof, type TeacherAgenticTransport,
} from './agentic-text-contract.js';

/** Existing private Native service and token; no browser endpoint or credential projection. */
@Injectable()
export class GeminiTeacherTextTransport implements TeacherAgenticTransport {
  constructor(private readonly transport: NodiaAiAdapterTransport) {}
  async observe(selection: AiSelection, configurationGeneration: string, signal: AbortSignal) {
    return parseTeacherAgenticObservation(await this.transport.request('/teacher/agentic-text/observe', {
      contract: TEACHER_AGENTIC_CONTRACT, model_id: selection.model_id, effort_id: selection.effort_id,
      configuration_generation: configurationGeneration,
    }, signal), 'gemini');
  }
  async start(command: TeacherAgenticCommand, signal: AbortSignal) {
    const { prompt: _prompt, deadline_at: _deadline, ...reference } = command;
    let excluded = false;
    try {
      return parseTeacherAgenticSnapshot(await this.transport.request('/teacher/agentic-text/start', command, signal, true,
        (body, status) => { excluded = dispatchExcluded(body, status, command); }), reference);
    } catch (error) {
      if (excluded) throw new TeacherAgenticClosedError({ provider: 'gemini', reference }, null, true, 'native_dispatch_excluded');
      throw error;
    }
  }
  async status(reference: TeacherAgenticReference, signal: AbortSignal) {
    return parseTeacherAgenticSnapshot(await this.transport.request('/teacher/agentic-text/status', reference, signal), reference);
  }
  async reconcile(reference: TeacherAgenticReference, signal: AbortSignal) {
    return parseTeacherAgenticSnapshot(await this.transport.request('/teacher/agentic-text/reconcile', reference, signal), reference);
  }
  async acknowledge(reference: TeacherAgenticReference, proof: TeacherAgenticProof, signal: AbortSignal) {
    parseTeacherAgenticProof(proof, reference);
    const value = await this.transport.request('/teacher/agentic-text/ack', {
      ...reference, terminal_proof_id: proof.terminal_proof_id, response_hash: proof.response_hash,
    }, signal);
    // ACK response is deliberately not a source of generated content or authority.
    if (value === null || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).length !== 1 || !('acknowledged' in value) || value.acknowledged !== true) throw Error('teacher:agentic_ack_unproven');
  }
}

function dispatchExcluded(body: unknown, status: number, command: TeacherAgenticCommand): boolean {
  if (status < 400 || status >= 500 || body === null || typeof body !== 'object' || Array.isArray(body)) return false;
  const outer = body as Record<string, unknown>, raw = outer.dispatch_exclusion_proof;
  if (Object.keys(outer).sort().join(',') !== 'code,detail,dispatch_exclusion_proof'
      || typeof outer.code !== 'string' || !/^[a-z_]{1,100}$/.test(outer.code)
      || typeof outer.detail !== 'string' || Buffer.byteLength(outer.detail, 'utf8') > 4096
      || raw === null || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const proof = raw as Record<string, unknown>;
  return Object.keys(proof).sort().join(',') === 'contract,dispatch_exclusion,observed_at,operation_id,process_started,provider_started,request_hash,runtime_hash,session_generation'
    && proof.contract === TEACHER_AGENTIC_CONTRACT && proof.operation_id === command.operation_id
    && proof.request_hash === command.request_hash && proof.session_generation === command.session_generation
    && proof.runtime_hash === command.runtime_hash && proof.process_started === false && proof.provider_started === false
    && proof.dispatch_exclusion === true && typeof proof.observed_at === 'string'
    && /^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(proof.observed_at) && Number.isFinite(Date.parse(proof.observed_at));
}
