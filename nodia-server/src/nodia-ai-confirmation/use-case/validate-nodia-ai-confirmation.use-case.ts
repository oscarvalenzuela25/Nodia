import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { ValidateFunction } from 'ajv';
import { compileNodiaAiToolSchema } from '../../nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';
import { CanonicalizeNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/canonicalize-nodia-ai-proposal.use-case.js';
import {
  ConfirmNodiaAiProposalDto,
  NodiaAiConfirmationChallengeDto,
  NodiaAiExecutionControlDto,
} from '../dto/nodia-ai-confirmation.dto.js';
export const NODIA_AI_CONFIRMATION_COMMON_SCHEMA = Symbol(
  'NODIA_AI_CONFIRMATION_COMMON_SCHEMA',
);
export interface NodiaAiChallengeRequest {
  proposal_revision: number;
  expected_hash: string;
}
export interface NodiaAiConfirmRequest extends NodiaAiChallengeRequest {
  client_request_id: string;
  confirmation_token: string;
}
export interface NodiaAiExecutionControlRequest {
  client_request_id: string;
  expected_execution_revision: number;
}
@Injectable()
export class ValidateNodiaAiConfirmationUseCase {
  private readonly schemas = new Map<string, ValidateFunction>();
  constructor(
    @Inject(NODIA_AI_CONFIRMATION_COMMON_SCHEMA) source: string,
    private readonly canonical: CanonicalizeNodiaAiProposalUseCase,
  ) {
    for (const definition of [
      'ConfirmationChallengeRequest',
      'ConfirmationChallengeResponse',
      'ConfirmationRequest',
      'ExecutionAccepted',
      'ExecutionStatus',
      'FinancialMovementReceipt',
      'FinancialEffectReceipt',
      'BusinessEffectReceipt',
      'RentalEffectReceipt',
      'CoreEffectReceipt',
      'AiProviderEffectReceipt',
      'PreferenceEffectReceipt',
      'SecureFlowReceipt',
      'ResumeExecutionRequest',
      'ExecutionCancelRequest',
      'ExecutionCancellationResult',
    ])
      this.schemas.set(
        definition,
        compileNodiaAiToolSchema({
          sourceJson: source,
          definition,
          sha256: createHash('sha256').update(source).digest('hex'),
        }).validate,
      );
  }
  input(value: unknown, operation: 'challenge'): NodiaAiChallengeRequest;
  input(value: unknown, operation: 'confirm'): NodiaAiConfirmRequest;
  input(
    value: unknown,
    operation: 'challenge' | 'confirm',
  ): NodiaAiChallengeRequest | NodiaAiConfirmRequest {
    const expected =
      operation === 'confirm'
        ? ConfirmNodiaAiProposalDto.prototype
        : NodiaAiConfirmationChallengeDto.prototype;
    let normalized: unknown = value;
    if (
      value &&
      typeof value === 'object' &&
      Object.getPrototypeOf(value) === expected
    ) {
      const keys =
        operation === 'confirm'
          ? [
              'client_request_id',
              'proposal_revision',
              'expected_hash',
              'confirmation_token',
            ]
          : ['proposal_revision', 'expected_hash'];
      const descriptors = Object.getOwnPropertyDescriptors(value);
      if (
        Reflect.ownKeys(value).length !== keys.length ||
        keys.some(
          (key) =>
            !descriptors[key]?.enumerable ||
            !Object.hasOwn(descriptors[key], 'value'),
        )
      )
        throw new BadRequestException('nodia_ai:invalid_input');
      normalized = Object.fromEntries(
        keys.map((key) => [key, descriptors[key].value as unknown]),
      );
    }
    this.assert(
      operation === 'confirm'
        ? 'ConfirmationRequest'
        : 'ConfirmationChallengeRequest',
      normalized,
    );
    if (
      operation === 'confirm' &&
      !/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(
        (normalized as NodiaAiConfirmRequest).confirmation_token,
      )
    )
      throw new BadRequestException('nodia_ai:invalid_input');
    return normalized as NodiaAiChallengeRequest | NodiaAiConfirmRequest;
  }
  hash(value: unknown): string {
    return createHash('sha256')
      .update(this.canonical.execute(value))
      .digest('hex');
  }
  control(
    value: unknown,
    operation: 'resume' | 'cancel',
  ): NodiaAiExecutionControlRequest {
    let normalized = value;
    if (
      value &&
      typeof value === 'object' &&
      Object.getPrototypeOf(value) === NodiaAiExecutionControlDto.prototype
    ) {
      const keys = ['client_request_id', 'expected_execution_revision'];
      const descriptors = Object.getOwnPropertyDescriptors(value);
      if (
        Reflect.ownKeys(value).length !== keys.length ||
        keys.some(
          (key) =>
            !descriptors[key]?.enumerable ||
            !Object.hasOwn(descriptors[key], 'value'),
        )
      )
        throw new BadRequestException('nodia_ai:invalid_input');
      normalized = Object.fromEntries(
        keys.map((key) => [key, descriptors[key].value as unknown]),
      );
    }
    this.assert(
      operation === 'resume'
        ? 'ResumeExecutionRequest'
        : 'ExecutionCancelRequest',
      normalized,
    );
    const result = normalized as NodiaAiExecutionControlRequest;
    if (
      !Number.isSafeInteger(result.expected_execution_revision) ||
      result.expected_execution_revision > 2147483647
    )
      throw new BadRequestException('nodia_ai:invalid_input');
    return result;
  }
  assert(definition: string, value: unknown, persisted = false): void {
    try {
      this.canonical.execute(value);
      if (!this.schemas.get(definition)?.(value))
        throw new Error('invalid_schema');
    } catch {
      if (persisted)
        throw new InternalServerErrorException(
          'nodia_ai:invalid_persisted_state',
        );
      throw new BadRequestException('nodia_ai:invalid_input');
    }
  }
}
