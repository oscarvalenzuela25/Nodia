import {
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { QueryFailedError, type EntityManager } from 'typeorm';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { CashBusinessScope } from '../cash-business-scope.js';
import {
  CASH_MUTATION_CONTRACT_VERSION,
  CashMutationRequestsService,
  type CashReceiptIdentity,
} from '../cash-mutation-requests.service.js';
import type { CreateCashCategoryDto } from '../dto/create-cash-category.dto.js';
import type { UpdateCashCategoryDto } from '../dto/update-cash-category.dto.js';
import {
  CASH_MAX_VERSION,
  normalizeCashCategoryCreate,
  normalizeCashCategoryUpdate,
  publicCashCategory,
  type CashCategoryFields,
} from '../policies/cash-category.policy.js';
import type {
  CashCategory,
  CashCategoryMutationResult,
  CashCategoryOperation,
  CashRejectedResult,
} from '../types/cash.types.js';

type CategoryChange = Partial<CashCategoryFields> & {
  expected_version: number;
};
type Reservation = Awaited<ReturnType<CashMutationRequestsService['reserve']>>;
type IdentifiedMutation = CashReceiptIdentity & {
  operation: CashCategoryOperation;
  fingerprint: string;
};
const categoryColumns =
  'id, business_id, name, description, is_active, version';
const versionConflict = 'business:cash_version_conflict';

function fingerprint(
  operation: CashCategoryOperation,
  target: string,
  command: CategoryChange | CashCategoryFields,
) {
  const { normalized_name: _canonicalName, ...intent } = command;
  const fields = Object.entries(intent).sort(([left], [right]) =>
    left < right ? -1 : Number(left > right),
  );
  return createHash('sha256')
    .update(
      JSON.stringify([
        'cash-mutation',
        CASH_MUTATION_CONTRACT_VERSION,
        operation,
        target,
        fields,
      ]),
    )
    .digest('hex');
}

function definitiveRejection(error: unknown): CashRejectedResult | undefined {
  if (error instanceof ConflictException && error.message === versionConflict) {
    return { status_code: 409, message: versionConflict };
  }
  if (
    error instanceof QueryFailedError &&
    error.driverError.code === '23505' &&
    error.driverError.constraint ===
      'uq_business_cash_categories_business_normalized_name'
  ) {
    return { status_code: 409, message: 'business:cash_category_name_exists' };
  }
}

@Injectable()
export class MutateCashCategoryUseCase {
  constructor(
    private readonly scope: CashBusinessScope,
    private readonly requests: CashMutationRequestsService,
  ) {}

  async create(
    dto: CreateCashCategoryDto,
    actor: ActorReference,
  ): Promise<CashCategoryMutationResult> {
    const { request_key, business_id, ...fields } =
      normalizeCashCategoryCreate(dto);
    const request = {
      businessId: business_id,
      actorId: actor.userId,
      requestKey: request_key,
      operation: 'category_create',
      fingerprint: fingerprint('category_create', business_id, fields),
    } satisfies IdentifiedMutation;
    const reservation = await this.scope.run(business_id, actor, (manager) =>
      this.requests.reserve(manager, request),
    );
    return this.finish(request, reservation, actor, async (manager) => {
      const [category] = await manager.query<CashCategory[]>(
        `INSERT INTO business_cash_categories
           (business_id, name, normalized_name, description, is_active, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$6) RETURNING ${categoryColumns}`,
        [
          business_id,
          fields.name,
          fields.normalized_name,
          fields.description,
          fields.is_active,
          actor.userId,
        ],
      );
      return category;
    });
  }

  async update(
    id: string,
    dto: UpdateCashCategoryDto,
    actor: ActorReference,
  ): Promise<CashCategoryMutationResult> {
    const { request_key, ...fields } = normalizeCashCategoryUpdate(dto);
    const { request, reservation } = await this.scope.forCategory(
      id,
      actor,
      async (manager, businessId) => {
        const request = {
          businessId,
          actorId: actor.userId,
          requestKey: request_key,
          operation: 'category_update',
          fingerprint: fingerprint('category_update', id, fields),
        } satisfies IdentifiedMutation;
        const reservation = await this.requests.reserve(manager, request);
        return { request, reservation };
      },
    );
    return this.finish(request, reservation, actor, (manager) =>
      this.updateCategory(manager, request, id, fields),
    );
  }

  private async finish(
    request: IdentifiedMutation,
    reservation: Reservation,
    actor: ActorReference,
    write: (manager: EntityManager) => Promise<CashCategory>,
  ): Promise<CashCategoryMutationResult> {
    if ('receipt' in reservation) {
      const { receipt } = reservation;
      if (receipt.status === 'rejected')
        throw new HttpException(
          receipt.error.message,
          receipt.error.status_code,
        );
      if (receipt.status === 'retryable')
        throw new ServiceUnavailableException(
          'business:cash_mutation_unavailable',
        );
      return receipt;
    }

    const { attemptId } = reservation;
    try {
      return await this.scope.run(
        request.businessId,
        actor,
        async (manager) => {
          await this.requests.holdAttempt(manager, request, attemptId);
          const result = { category: publicCashCategory(await write(manager)) };
          await this.requests.settle(manager, request, attemptId, {
            status: 'committed',
            result,
          });
          return {
            request_key: request.requestKey,
            operation: request.operation,
            status: 'committed',
            result,
          };
        },
      );
    } catch (error) {
      // Only known domain failures prove rejection. In particular a failed
      // acknowledgement of COMMIT must be reconciled through the receipt.
      const rejection = definitiveRejection(error);
      if (!rejection) throw error;
      await this.scope.run(request.businessId, actor, (manager) =>
        this.requests.settle(manager, request, attemptId, {
          status: 'rejected',
          error: rejection,
        }),
      );
      throw new HttpException(rejection.message, rejection.status_code);
    }
  }

  private async updateCategory(
    manager: EntityManager,
    request: IdentifiedMutation,
    id: string,
    fields: CategoryChange,
  ): Promise<CashCategory> {
    const [before] = await manager.query<
      (CashCategory & { normalized_name: string })[]
    >(
      `SELECT ${categoryColumns}, normalized_name FROM business_cash_categories
       WHERE id=$1 AND business_id=$2 FOR UPDATE`,
      [id, request.businessId],
    );
    if (!before) throw new NotFoundException('business:resource_not_found');
    if (before.version !== fields.expected_version)
      throw new ConflictException(versionConflict);
    const name = fields.name ?? before.name;
    const canonical = fields.normalized_name ?? before.normalized_name;
    const description = fields.description ?? before.description;
    const active = fields.is_active ?? before.is_active;
    if (
      name === before.name &&
      canonical === before.normalized_name &&
      description === before.description &&
      active === before.is_active
    )
      return before;
    if (before.version >= CASH_MAX_VERSION)
      throw new ConflictException(versionConflict);
    const [category] = await manager.query<CashCategory[]>(
      `WITH updated AS (
         UPDATE business_cash_categories
         SET name=$3, normalized_name=$4, description=$5, is_active=$6,
             version=version+1, updated_by=$7, updated_at=clock_timestamp()
         WHERE id=$1 AND business_id=$2
         RETURNING ${categoryColumns}
       ) SELECT * FROM updated`,
      [
        id,
        request.businessId,
        name,
        canonical,
        description,
        active,
        request.actorId,
      ],
    );
    return category;
  }
}
