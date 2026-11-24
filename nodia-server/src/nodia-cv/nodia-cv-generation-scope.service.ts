import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import {
  lockAuthority,
  currentActor,
  type ActorReference,
  type CurrentActor,
} from '../authorization/authority-transaction.js';
import { CheckModuleAccessUseCase } from '../authorization/use-case/check-module-access.use-case.js';
import { lockNodiaAiQueue } from '../nodia-ai-runtime/queue-lock.js';
import { NODIA_CV_ROUTE } from './types/nodia-cv-profile.types.js';

@Injectable()
export class NodiaCvGenerationScope {
  constructor(
    private readonly source: DataSource,
    private readonly modules: CheckModuleAccessUseCase,
  ) {}

  transaction<T>(work: (manager: EntityManager) => Promise<T>, queue = false) {
    return this.source.transaction(async (manager) => {
      await lockAuthority(manager);
      if (queue) await lockNodiaAiQueue(manager);
      return work(manager);
    });
  }

  async authorize(
    manager: EntityManager,
    actor: ActorReference,
  ): Promise<CurrentActor> {
    const current = await currentActor(manager, actor);
    await this.modules.execute(current.actorId, [NODIA_CV_ROUTE], manager);
    return current;
  }
}
