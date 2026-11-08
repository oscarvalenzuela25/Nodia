import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { isUUID } from 'class-validator';
import { assertBusinessesAccess } from '../../business-access/business-access.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type {
  NodiaAiProposalPreparer,
  ProposalPreparation,
  ProposalPreparerContext,
  StoredProposalStep,
} from '../../nodia-ai-proposal/types/proposal-preparer.types.js';

const operations = [
  'create',
  'update',
  'complete',
  'cancel',
  'discard',
] as const;
type HistoricalOperation = (typeof operations)[number];
const retired = (): never => {
  throw new BadRequestException('nodia_ai:catalog_changed');
};

/** Frozen proposal reading only. It has no sale writer, preparation or execution dependency. */
class HistoricalSalesReader implements NodiaAiProposalPreparer {
  readonly toolName: string;
  readonly contractHash: string;
  readonly catalogVersion = 'nodia-ai-pos/1';
  readonly moduleRoutes = ['/business'];
  readonly actionKeys = [];
  readonly editableFields = {};
  readonly bindableFields = {};
  readonly outputKeys = {};

  constructor(private readonly operation: HistoricalOperation) {
    this.toolName = `nodia_sales_prepare_${operation}`;
    this.contractHash = createHash('sha256')
      .update(`historical_sales_read_only/1:${this.toolName}`)
      .digest('hex');
  }

  async prepare(): Promise<ProposalPreparation> {
    return retired();
  }
  async applyEdits(): Promise<NodiaAiJsonObject> {
    return retired();
  }
  async verifyAuthority(): Promise<void> {
    return retired();
  }
  async verifyPreconditions(): Promise<void> {
    return retired();
  }

  async verifyHistoricalReadAuthority(
    step: StoredProposalStep,
    context: ProposalPreparerContext,
  ): Promise<void> {
    const template = step.commandTemplate;
    if (
      step.toolName !== this.toolName ||
      !/^[a-f0-9]{64}$/.test(step.contractHash) ||
      Object.keys(template).sort().join(',') !==
        'business_id,command,defaulted_payment_method,id' ||
      typeof template.business_id !== 'string' ||
      !isUUID(template.business_id) ||
      typeof template.defaulted_payment_method !== 'boolean' ||
      !template.command ||
      typeof template.command !== 'object' ||
      Array.isArray(template.command) ||
      (this.operation === 'create'
        ? template.id !== null
        : typeof template.id !== 'string' || !isUUID(template.id)) ||
      !isDeepStrictEqual(step.scope, { business_id: template.business_id }) ||
      !context.moduleRoutes.includes('/business') ||
      !context.manager.queryRunner?.isTransactionActive
    )
      throw new ForbiddenException('nodia_ai:capability_denied');

    await assertBusinessesAccess(
      context.manager,
      {
        userId: context.actor.actorId,
        sessionId: context.actor.sessionId,
      },
      [template.business_id],
      { lock: true },
    );
  }
}

@Injectable()
export class BuildNodiaAiHistoricalSalesReadersUseCase {
  readonly historicalReaders: readonly NodiaAiProposalPreparer[] =
    Object.freeze(
      operations.map((operation) => new HistoricalSalesReader(operation)),
    );
}
