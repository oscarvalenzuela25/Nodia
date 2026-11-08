import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type { NodiaAiNativeOperation } from '../../nodia-ai-proposal/types/native-operation.types.js';
import type {
  ProposalFieldEdit,
  ProposalPreparation,
  ProposalPreparerContext,
  StoredProposalStep,
} from '../../nodia-ai-proposal/types/proposal-preparer.types.js';

export const SALE_OPERATIONS = [
  'create',
  'update',
  'complete',
  'cancel',
  'discard',
] as const;
type Operation = (typeof SALE_OPERATIONS)[number];
const retired = (): never => {
  throw new BadRequestException('nodia_ai:catalog_changed');
};

/** Historical identity metadata only. Sales are never prepared or written by NodiaAI. */
export class NodiaAiSalesOperation implements NodiaAiNativeOperation {
  readonly resourceKey = 'sales' as const;
  readonly toolName: string;
  readonly catalogVersion = 'nodia-ai-pos/1';
  readonly contractHash: string;
  readonly moduleRoutes = ['/business'];
  readonly actionKeys: readonly string[] = [];
  readonly editableFields: Readonly<Record<string, string>>;
  readonly bindableFields = {};
  readonly outputKeys = { sale_id: 'sale_id', business_id: 'business_id' };
  constructor(
    readonly operation: Operation,
    _retiredWriter?: unknown,
  ) {
    this.toolName = `nodia_sales_prepare_${operation}`;
    // Preserve the old hash for immutable receipts; none of these fields grants an operation.
    this.editableFields = Object.freeze(
      Object.fromEntries(
        (operation === 'create' || operation === 'update'
          ? ['items', 'payment_method', 'payment_method_description']
          : operation === 'cancel'
            ? ['cancellation_reason']
            : []
        ).map((key) => [key, key === 'items' ? 'sale_items' : 'string']),
      ),
    );
    this.contractHash = createHash('sha256')
      .update(
        JSON.stringify({
          operation,
          schema: 'sale_preparation/1',
          pricing: 'frozen_exact_effective/1',
          native: 'shared_manager_identity_execution_step/1',
          fields: this.editableFields,
        }),
      )
      .digest('hex');
  }
  async prepare(
    _partial: NodiaAiJsonObject,
    _context: ProposalPreparerContext,
    _previous?: NodiaAiJsonObject,
  ): Promise<ProposalPreparation> {
    return retired();
  }
  async reprepareStored(
    _template: NodiaAiJsonObject,
    _context: ProposalPreparerContext,
  ): Promise<ProposalPreparation> {
    return retired();
  }
  async applyEdits(
    _template: NodiaAiJsonObject,
    _edits: readonly ProposalFieldEdit[],
    _context: ProposalPreparerContext,
  ): Promise<NodiaAiJsonObject> {
    return retired();
  }
  async verifyAuthority(
    _step: StoredProposalStep,
    _context: ProposalPreparerContext,
  ): Promise<void> {
    return retired();
  }
  async verifyPreconditions(
    _step: StoredProposalStep,
    _context: ProposalPreparerContext,
  ): Promise<void> {
    return retired();
  }
  async executeConfirmed(
    _step: StoredProposalStep,
    _context: ProposalPreparerContext,
  ): Promise<{ id: string; businessId: string }> {
    return retired();
  }
}

/** Compatibility export with no runtime writers, even for explicit internal construction. */
@Injectable()
export class BuildNodiaAiSalesOperationsUseCase {
  readonly operations: readonly NodiaAiNativeOperation[] = Object.freeze([]);
  constructor(_retiredWriter?: unknown) {}
}
