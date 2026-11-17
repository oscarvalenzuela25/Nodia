import {
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { QueryFailedError, type EntityManager } from 'typeorm';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { CashBusinessScope } from '../cash-business-scope.js';
import {
  CASH_MUTATION_CONTRACT_VERSION,
  CashMutationRequestsService,
  type CashRequest,
} from '../cash-mutation-requests.service.js';
import type {
  CashMutationPayload,
  CashMutationResult,
  CashOperation,
  CashRejectedResult,
} from '../types/cash.types.js';

type CashTarget =
  | { kind: 'business'; id: string }
  | { kind: 'category'; id: string }
  | { kind: 'movement'; id: string };

interface CashCommand<Operation extends CashOperation> {
  requestKey: string;
  operation: Operation;
  target: CashTarget;
  intent: Readonly<Record<string, string | boolean | number>>;
}

export class CashWriteRejection extends HttpException {
  constructor(status: 404 | 409, message: string) {
    super(message, status);
  }
}

function fingerprint(command: CashCommand<CashOperation>): string {
  const fields = Object.entries(command.intent).sort(([left], [right]) =>
    left < right ? -1 : Number(left > right),
  );
  return createHash('sha256')
    .update(
      JSON.stringify([
        'cash-mutation',
        CASH_MUTATION_CONTRACT_VERSION,
        command.operation,
        command.target.id,
        fields,
      ]),
    )
    .digest('hex');
}

function definitiveRejection(error: unknown): CashRejectedResult | undefined {
  if (error instanceof CashWriteRejection) {
    return { status_code: error.getStatus(), message: error.message };
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
export class ExecuteCashMutationUseCase {
  constructor(
    private readonly scope: CashBusinessScope,
    private readonly requests: CashMutationRequestsService,
  ) {}

  async execute<Operation extends CashOperation>(
    command: CashCommand<Operation>,
    actor: ActorReference,
    write: (
      manager: EntityManager,
      businessId: string,
    ) => Promise<CashMutationPayload<NoInfer<Operation>>>,
  ): Promise<CashMutationResult<Operation>> {
    const { target, operation, requestKey } = command;
    const requestHash = fingerprint(command);
    const reserve = async (manager: EntityManager, businessId: string) => {
      const request: CashRequest<Operation> = {
        businessId,
        actorId: actor.userId,
        requestKey,
        operation,
        fingerprint: requestHash,
      };
      return {
        request,
        reservation: await this.requests.reserve(manager, request),
      };
    };

    const { request, reservation } = await this.authorize(
      target,
      actor,
      reserve,
    );
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

    const { businessId } = request;
    const { attemptId } = reservation;
    try {
      return await this.scope.run(businessId, actor, async (manager) => {
        await this.requests.holdAttempt(manager, request, attemptId);
        const result = await write(manager, businessId);
        await this.requests.settle<Operation>(manager, request, attemptId, {
          status: 'committed',
          result,
        });
        return {
          request_key: requestKey,
          operation,
          status: 'committed',
          result,
        };
      });
    } catch (error) {
      // A failed COMMIT acknowledgement does not prove that the write rolled back.
      const rejection = definitiveRejection(error);
      if (!rejection) throw error;
      await this.scope.run(businessId, actor, (manager) =>
        this.requests.settle(manager, request, attemptId, {
          status: 'rejected',
          error: rejection,
        }),
      );
      throw new HttpException(rejection.message, rejection.status_code);
    }
  }

  private authorize<T>(
    target: CashTarget,
    actor: ActorReference,
    reserve: (manager: EntityManager, businessId: string) => Promise<T>,
  ): Promise<T> {
    switch (target.kind) {
      case 'business':
        return this.scope.run(target.id, actor, (manager) =>
          reserve(manager, target.id),
        );
      case 'category':
        return this.scope.forCategory(target.id, actor, reserve);
      case 'movement':
        return this.scope.forMovement(target.id, actor, reserve);
    }
  }
}
