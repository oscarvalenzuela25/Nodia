import { BadRequestException } from '@nestjs/common';
import {
  CancelNodiaAiProposalDto,
  NodiaAiProposalFieldEditDto,
  UpdateNodiaAiProposalDto,
} from '../dto/nodia-ai-proposal.dto.js';

function dtoData(
  input: object,
  keys: readonly string[],
): Record<string, unknown> {
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (
    Reflect.ownKeys(input).length !== Object.keys(descriptors).length ||
    Object.keys(descriptors).some((key) => !keys.includes(key)) ||
    keys.some(
      (key) =>
        !Object.hasOwn(descriptors, key) ||
        !Object.hasOwn(descriptors[key], 'value') ||
        !descriptors[key].enumerable,
    )
  )
    throw new BadRequestException('nodia_ai:invalid_input');
  // No spread, getters, toJSON, implicit coercion or arbitrary prototype traversal.
  return Object.fromEntries(
    keys.map((key) => [key, descriptors[key].value as unknown]),
  );
}

/** Adapt only the exact classes constructed by Nest's ValidationPipe. JCS itself stays JSON-only. */
export function normalizeNodiaAiProposalInput(
  input: unknown,
  operation: 'update' | 'cancel',
  maxEdits: number,
): unknown {
  if (!input || typeof input !== 'object') return input;
  const prototype: unknown = Object.getPrototypeOf(input);
  if (
    operation === 'cancel' &&
    prototype === CancelNodiaAiProposalDto.prototype
  )
    return dtoData(input, ['client_request_id', 'expected_proposal_revision']);
  if (
    operation !== 'update' ||
    prototype !== UpdateNodiaAiProposalDto.prototype
  )
    return input;
  const result = dtoData(input, [
    'expected_proposal_revision',
    'expected_hash',
    'edits',
  ]);
  if (Array.isArray(result.edits)) {
    const descriptors = Object.getOwnPropertyDescriptors(result.edits as object);
    const length: unknown = descriptors.length.value;
    if (
      Object.getPrototypeOf(result.edits) !== Array.prototype ||
      typeof length !== 'number' ||
      length > maxEdits ||
      Reflect.ownKeys(result.edits).length !== length + 1
    )
      throw new BadRequestException('nodia_ai:invalid_input');
    const edits: unknown[] = [];
    for (let index = 0; index < length; index++) {
      const descriptor = descriptors[String(index)];
      if (
        !descriptor ||
        !Object.hasOwn(descriptor, 'value') ||
        !descriptor.enumerable
      )
        throw new BadRequestException('nodia_ai:invalid_input');
      const edit: unknown = descriptor.value;
      edits.push(
        edit &&
          typeof edit === 'object' &&
          Object.getPrototypeOf(edit) === NodiaAiProposalFieldEditDto.prototype
          ? dtoData(edit, ['step_id', 'field_key', 'value'])
          : edit,
      );
    }
    result.edits = edits;
  }
  return result;
}
