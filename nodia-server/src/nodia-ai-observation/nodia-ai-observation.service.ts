import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { NodiaAiEvent } from '../nodia-ai-run/entities/nodia-ai-event.entity.js';
import { NodiaAiRun } from '../nodia-ai-run/entities/nodia-ai-run.entity.js';
import { NodiaAiToolCall } from '../nodia-ai-run/entities/nodia-ai-tool-call.entity.js';

/** Read side only. It cannot enqueue, dispatch, acknowledge or replay work. */
@Injectable()
export class NodiaAiObservationService {
  constructor(private readonly source: DataSource) {}
  transaction<T>(work: (manager: EntityManager) => Promise<T>) {
    return this.source.transaction(work);
  }
  run(manager: EntityManager, id: string) {
    return manager.getRepository(NodiaAiRun).findOneBy({ id });
  }
  events(manager: EntityManager, runId: string, after: string, limit: number) {
    return manager
      .getRepository(NodiaAiEvent)
      .createQueryBuilder('event')
      .where('event.run_id = :runId', { runId })
      .andWhere('event.seq > :after', { after })
      .orderBy('event.seq', 'ASC')
      .take(limit + 1)
      .getMany();
  }
  toolRefs(manager: EntityManager, runId: string, limit: number) {
    return manager.getRepository(NodiaAiToolCall).find({
      where: { run_id: runId, state: 'completed' },
      select: { id: true, tool_name: true, contract_hash: true },
      order: { id: 'ASC' },
      take: limit + 1,
    });
  }
  proposalEvents(manager: EntityManager, runId: string, limit: number) {
    return manager
      .getRepository(NodiaAiEvent)
      .createQueryBuilder('event')
      .where('event.run_id = :runId', { runId })
      .andWhere("event.public_payload->>'kind' = 'proposal_ready'")
      .orderBy('event.seq', 'ASC')
      .take(limit + 1)
      .getMany();
  }
}
