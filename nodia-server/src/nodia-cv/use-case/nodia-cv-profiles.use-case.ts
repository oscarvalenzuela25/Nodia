import { Inject, Injectable, InternalServerErrorException, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, type EntityManager } from 'typeorm';
import {
  currentActor,
  lockAuthority,
  type ActorReference,
  type CurrentActor,
} from '../../authorization/authority-transaction.js';
import { CheckModuleAccessUseCase } from '../../authorization/use-case/check-module-access.use-case.js';
import {
  NODIA_AI_DELETION_JOURNAL,
  type NodiaAiDeletionJournalPort,
} from '../../nodia-ai-recovery/types/deletion-journal.js';
import { lockNodiaAiQueue } from '../../nodia-ai-runtime/queue-lock.js';
import { NodiaCvGenerationStore } from '../nodia-cv-generation.store.js';
import type {
  CreateNodiaCvProfileDto,
  NodiaCvProfileListQueryDto,
  UpdateNodiaCvProfileDto,
} from '../dto/nodia-cv-profile.dto.js';
import type { NodiaCvProfileEntity } from '../entities/nodia-cv-profile.entity.js';
import {
  NodiaCvProfilesService,
  profileSummary,
} from '../nodia-cv-profiles.service.js';
import { nodiaCvProfileError } from '../policies/nodia-cv-profile-errors.js';
import { protectNodiaCvDelete } from '../policies/nodia-cv-protected-delete.js';
import {
  readNodiaCvProfile,
  withNodiaCvEntryIds,
} from '../policies/nodia-cv-profile.js';
import {
  NODIA_CV_ROUTE,
  type NodiaCvProfileDetail,
} from '../types/nodia-cv-profile.types.js';

function profileDetail(row: NodiaCvProfileEntity): NodiaCvProfileDetail {
  return { ...profileSummary(row), ...row.data };
}

@Injectable()
export class NodiaCvProfilesUseCase {
  constructor(
    private readonly source: DataSource,
    private readonly modules: CheckModuleAccessUseCase,
    private readonly profiles: NodiaCvProfilesService,
    private readonly generations: NodiaCvGenerationStore,
    @Optional() @Inject(NODIA_AI_DELETION_JOURNAL)
    private readonly deletionJournal?: NodiaAiDeletionJournalPort,
  ) {}

  list(actor: ActorReference, query: NodiaCvProfileListQueryDto) {
    return this.scope(
      actor,
      async (manager, current) => {
        const [rows, total] = await this.profiles.list(
          manager,
          current.actorId,
          query.page,
          query.page_size,
        );
        return {
          items: rows.map(profileSummary),
          total,
          page: query.page,
          page_size: query.page_size,
        };
      },
      'REPEATABLE READ',
    );
  }

  detail(actor: ActorReference, id: string) {
    return this.scope(actor, async (manager, current) => {
      const row = await this.profiles.find(
        manager,
        id,
        current.isSuperAdmin ? undefined : current.actorId,
      );
      if (!row) nodiaCvProfileError('profile_not_found');
      return profileDetail(row);
    });
  }

  create(actor: ActorReference, input: CreateNodiaCvProfileDto) {
    const { profile, requestHash } = readNodiaCvProfile(input.profile);
    const data = withNodiaCvEntryIds(profile.data);
    return this.scope(actor, async (manager, { actorId }) => {
      const id = randomUUID();
      const key = input.request_key.toLowerCase();
      if (
        await this.profiles.claimCreate(manager, actorId, key, id, requestHash)
      ) {
        return profileDetail(
          await this.profiles.insert(manager, {
            ...profile,
            id,
            owner_user_id: actorId,
            data,
          }),
        );
      }

      const previous = await this.profiles.getReceipt(manager, actorId, key);
      if (!previous)
        throw new InternalServerErrorException('nodiaCv:request_failed');
      if (previous.request_hash === null) nodiaCvProfileError('request_closed');
      if (previous.request_hash !== requestHash)
        nodiaCvProfileError('request_key_conflict');
      const row = await this.profiles.find(
        manager,
        previous.profile_id,
        actorId,
      );
      if (!row) nodiaCvProfileError('request_closed');
      return profileDetail(row);
    });
  }

  update(actor: ActorReference, id: string, input: UpdateNodiaCvProfileDto) {
    const { profile } = readNodiaCvProfile(input.profile);
    return this.scope(actor, async (manager, { actorId }) => {
      const row = await this.lockRevision(manager, actorId, id, input.revision);
      const data = withNodiaCvEntryIds(profile.data, row.data);
      return profileDetail(
        await this.profiles.replace(manager, row, { ...profile, data }),
      );
    });
  }

  delete(actor: ActorReference, id: string, revision: number) {
    return protectNodiaCvDelete(
      this.deletionJournal,
      () => this.scope(actor, async (manager, { actorId }) => {
        const row = await this.lockRevision(manager, actorId, id, revision);
        const [{ now }]: { now: Date }[] = await manager.query('SELECT clock_timestamp() AS now');
        return { resource: { kind: 'cv_profile', profile_id: row.id }, now };
      }),
      () => this.scope(actor, async (manager, { actorId }) => {
        await lockNodiaAiQueue(manager);
        const row = await this.lockRevision(manager, actorId, id, revision);
        await this.generations.removeProfileContent(manager, actorId, id);
        await this.profiles.delete(manager, row);
      }),
    );
  }

  private async lockRevision(
    manager: EntityManager,
    owner: string,
    id: string,
    revision: number,
  ) {
    const row = await this.profiles.find(manager, id, owner, true);
    if (!row) nodiaCvProfileError('profile_not_found');
    if (row.revision !== revision) nodiaCvProfileError('stale_profile');
    return row;
  }

  private scope<T>(
    actor: ActorReference,
    work: (manager: EntityManager, current: CurrentActor) => Promise<T>,
    isolation: 'READ COMMITTED' | 'REPEATABLE READ' = 'READ COMMITTED',
  ) {
    return this.source.transaction(isolation, async (manager) => {
      await lockAuthority(manager);
      const current = await currentActor(manager, actor);
      await this.modules.execute(current.actorId, [NODIA_CV_ROUTE], manager);
      return work(manager, current);
    });
  }
}
