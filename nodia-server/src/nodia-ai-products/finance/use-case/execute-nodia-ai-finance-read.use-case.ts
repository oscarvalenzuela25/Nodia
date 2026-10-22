import {
  Injectable,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import type { FinanceActor } from '../../../authorization/authority-transaction.js';
import type { FinanceQueryDto } from '../../../finance-common/dto/finance-query.dto.js';
import type { FinanceCategoryService } from '../../../finance-category/finance-category.service.js';
import type { GetFinanceCategoryUseCase } from '../../../finance-category/use-case/get-finance-category.use-case.js';
import type { GetFinanceCategoriesUseCase } from '../../../finance-category/use-case/get-finance-categories.use-case.js';
import type { GetFinanceCategoryGroupUseCase } from '../../../finance-category-group/use-case/get-finance-category-group.use-case.js';
import type { GetFinanceCategoryGroupsUseCase } from '../../../finance-category-group/use-case/get-finance-category-groups.use-case.js';
import type { GetFinanceMovementByIdUseCase } from '../../../finance-movement/use-case/get-finance-movement-by-id.use-case.js';
import type { GetFinanceMovementsUseCase } from '../../../finance-movement/use-case/get-finance-movements.use-case.js';
import type { GetFinanceObligationByIdUseCase } from '../../../finance-obligation/use-case/get-finance-obligation-by-id.use-case.js';
import type { GetFinanceObligationsUseCase } from '../../../finance-obligation/use-case/get-finance-obligations.use-case.js';
import type { GetFinanceOverviewUseCase } from '../../../finance-overview/use-case/get-finance-overview.use-case.js';
import type { GetFinanceCategorySummaryUseCase } from '../../../finance-overview/use-case/get-finance-category-summary.use-case.js';
import type { GetFinanceGroupSummaryUseCase } from '../../../finance-overview/use-case/get-finance-group-summary.use-case.js';
import type { NodiaAiJsonObject } from '../../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type { NodiaAiToolHandlerContext } from '../../../nodia-ai-tools/types/tool-registry.types.js';

export interface NodiaAiFinanceReadPorts {
  scope: Pick<FinanceCategoryService, 'withScope'>;
  category: Pick<GetFinanceCategoryUseCase, 'execute'>;
  categories: Pick<GetFinanceCategoriesUseCase, 'execute'>;
  group: Pick<GetFinanceCategoryGroupUseCase, 'execute'>;
  groups: Pick<GetFinanceCategoryGroupsUseCase, 'execute'>;
  movement: Pick<GetFinanceMovementByIdUseCase, 'execute'>;
  movements: Pick<GetFinanceMovementsUseCase, 'execute'>;
  obligation: Pick<GetFinanceObligationByIdUseCase, 'execute'>;
  obligations: Pick<GetFinanceObligationsUseCase, 'execute'>;
  overview: Pick<GetFinanceOverviewUseCase, 'execute'>;
  byCategory: Pick<GetFinanceCategorySummaryUseCase, 'execute'>;
  byGroup: Pick<GetFinanceGroupSummaryUseCase, 'execute'>;
}
export type FinanceReadOperation = Exclude<
  keyof NodiaAiFinanceReadPorts,
  'scope'
>;

/** The same native use cases own scope, filters and projections in HTTP and MCP. */
@Injectable()
export class ExecuteNodiaAiFinanceReadUseCase {
  constructor(private readonly ports: NodiaAiFinanceReadPorts) {}

  private actor(
    input: NodiaAiJsonObject,
    context: NodiaAiToolHandlerContext,
  ): FinanceActor {
    if (!context.manager.queryRunner?.isTransactionActive)
      throw new ForbiddenException('authorization:transaction_required');
    for (const value of [
      input.id,
      input.owner_id,
      input.obligation_id,
      ...(Array.isArray(input.category_ids) ? input.category_ids : []),
      ...(Array.isArray(input.category_group_ids)
        ? input.category_group_ids
        : []),
    ]) {
      if (
        value !== undefined &&
        (typeof value !== 'string' ||
          !/^[1-9][0-9]{0,18}$/.test(value) ||
          BigInt(value) > 9223372036854775807n)
      )
        throw new BadRequestException('finance:invalid_positive_integer');
    }
    return {
      userId: context.actor.actorId,
      sessionId: context.actor.sessionId,
      ...(typeof input.owner_id === 'string'
        ? { ownerId: input.owner_id }
        : {}),
      transaction: context.manager,
      statementTimeoutMs: context.statementTimeoutMs,
    };
  }

  async verifyAuthority(
    input: NodiaAiJsonObject,
    context: NodiaAiToolHandlerContext,
  ): Promise<void> {
    // Re-read native session/owner authority, including cached call recovery.
    const actor = this.actor(input, context);
    await this.requireSnapshot(context);
    await this.ports.scope.withScope(actor, async () => undefined);
  }

  private async requireSnapshot(
    context: NodiaAiToolHandlerContext,
  ): Promise<void> {
    const [isolation]: { transaction_isolation: string }[] =
      await context.manager.query('SHOW transaction_isolation');
    if (isolation?.transaction_isolation !== 'repeatable read')
      throw new ForbiddenException('authorization:transaction_isolation');
  }

  async verifyResultAuthority(
    input: NodiaAiJsonObject,
    result: NodiaAiJsonObject,
    context: NodiaAiToolHandlerContext,
  ): Promise<void> {
    await this.verifyAuthority(input, context);
    const ownerId =
      typeof input.owner_id === 'string'
        ? input.owner_id
        : context.actor.actorId;
    const rows = Array.isArray(result.data) ? result.data : [result];
    for (const row of rows) {
      if (
        row &&
        typeof row === 'object' &&
        !Array.isArray(row) &&
        'user_id' in row &&
        row.user_id !== ownerId
      )
        throw new ForbiddenException('finance:scope_denied');
    }
    if (input.id !== undefined && result.id !== input.id)
      throw new ForbiddenException('finance:scope_denied');
  }

  async execute(
    operation: FinanceReadOperation,
    input: NodiaAiJsonObject,
    context: NodiaAiToolHandlerContext,
  ): Promise<NodiaAiJsonObject> {
    const actor = this.actor(input, context);
    await this.requireSnapshot(context);
    let output: unknown;
    switch (operation) {
      case 'category':
        output = await this.ports.category.execute(actor, input.id as string);
        break;
      case 'group':
        output = await this.ports.group.execute(actor, input.id as string);
        break;
      case 'movement':
        output = await this.ports.movement.execute(actor, input.id as string);
        break;
      case 'obligation':
        output = await this.ports.obligation.execute(actor, input.id as string);
        break;
      default: {
        const { owner_id: _owner, ...query } = input;
        output = await this.ports[operation].execute(
          actor,
          query as unknown as FinanceQueryDto,
        );
      }
    }
    // Native projections contain Date values. JSON conversion follows HTTP exactly;
    // ToolRegistry validates the closed public result before durable storage.
    return JSON.parse(JSON.stringify(output)) as NodiaAiJsonObject;
  }
}
