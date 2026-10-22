import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import {
  lockAuthority,
  type ActorReference,
} from '../../authorization/authority-transaction.js';
import { AuthorizeNodiaAiUseCase } from './authorize-nodia-ai.use-case.js';
import type { NodiaAiAccessRequirements } from '../types/nodia-ai-authorization.types.js';

/** Shared effect boundary for registered ports, not a model-callable arbitrary callback. */
@Injectable()
export class ExecuteAuthorizedNodiaAiUseCase {
  constructor(
    private readonly source: DataSource,
    private readonly authorize: AuthorizeNodiaAiUseCase,
  ) {}
  execute<T>(
    identity: ActorReference,
    requirements: NodiaAiAccessRequirements,
    work: (actor: ActorReference, manager: EntityManager) => Promise<T>,
    isolation: 'READ COMMITTED' | 'REPEATABLE READ' = 'READ COMMITTED',
  ) {
    return this.source.transaction(isolation, async (manager) => {
      await lockAuthority(manager);
      await this.authorize.execute(identity, requirements, manager);
      return work({ ...identity, transaction: manager }, manager);
    });
  }
}
