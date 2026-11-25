import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { NodiaCvProfileCreateReceiptEntity } from './entities/nodia-cv-profile-create-receipt.entity.js';
import { NodiaCvProfileEntity } from './entities/nodia-cv-profile.entity.js';
import type {
  NodiaCvProfileData,
  NodiaCvProfileSummary,
} from './types/nodia-cv-profile.types.js';

const summaryFields = {
  id: true,
  revision: true,
  schema_version: true,
  created_at: true,
  updated_at: true,
  profile_name: true,
  full_name: true,
  professional_title: true,
} as const;

export function profileSummary(
  row: NodiaCvProfileEntity,
): NodiaCvProfileSummary {
  return {
    id: row.id,
    revision: row.revision,
    schema_version: row.schema_version,
    created_at: row.created_at,
    updated_at: row.updated_at,
    profile_name: row.profile_name,
    full_name: row.full_name,
    ...(row.professional_title
      ? { professional_title: row.professional_title }
      : {}),
  };
}

@Injectable()
export class NodiaCvProfilesService {
  async list(
    manager: EntityManager,
    owner: string,
    page: number,
    pageSize: number,
  ) {
    return manager.getRepository(NodiaCvProfileEntity).findAndCount({
      select: summaryFields,
      where: { owner_user_id: owner },
      order: { updated_at: 'DESC', id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  find(
    manager: EntityManager,
    id: string,
    owner?: string,
    lock: boolean | 'read' = false,
  ) {
    return manager.getRepository(NodiaCvProfileEntity).findOne({
      where: { id, ...(owner === undefined ? {} : { owner_user_id: owner }) },
      ...(lock
        ? {
            lock: {
              mode: lock === 'read' ? 'pessimistic_read' : 'pessimistic_write',
            },
          }
        : {}),
    });
  }

  async claimCreate(
    manager: EntityManager,
    owner: string,
    requestKey: string,
    profileId: string,
    hash: string,
  ) {
    const rows: { profile_id: string }[] = await manager.query(
      `INSERT INTO nodia_cv_profile_create_receipts (owner_user_id, request_key, profile_id, request_hash)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (owner_user_id, request_key) DO NOTHING RETURNING profile_id`,
      [owner, requestKey, profileId, hash],
    );
    return rows.length === 1;
  }

  getReceipt(manager: EntityManager, owner: string, requestKey: string) {
    return manager.getRepository(NodiaCvProfileCreateReceiptEntity).findOneBy({
      owner_user_id: owner,
      request_key: requestKey,
    });
  }

  async insert(
    manager: EntityManager,
    row: Pick<
      NodiaCvProfileEntity,
      | 'id'
      | 'owner_user_id'
      | 'profile_name'
      | 'full_name'
      | 'professional_title'
      | 'data'
    >,
  ) {
    const profiles = manager.getRepository(NodiaCvProfileEntity);
    await profiles.insert(row);
    return profiles.findOneByOrFail({
      id: row.id,
      owner_user_id: row.owner_user_id,
    });
  }

  async replace(
    manager: EntityManager,
    row: NodiaCvProfileEntity,
    input: {
      profile_name: string;
      full_name: string;
      professional_title: string | null;
      data: NodiaCvProfileData;
    },
  ) {
    const profiles = manager.getRepository(NodiaCvProfileEntity);
    const keys = { id: row.id, owner_user_id: row.owner_user_id };
    await profiles.update(keys, { ...input, revision: row.revision + 1 });
    return profiles.findOneByOrFail(keys);
  }

  async delete(manager: EntityManager, row: NodiaCvProfileEntity) {
    const keys = { owner_user_id: row.owner_user_id };
    await manager
      .getRepository(NodiaCvProfileCreateReceiptEntity)
      .update({ ...keys, profile_id: row.id }, { request_hash: null });
    await manager
      .getRepository(NodiaCvProfileEntity)
      .delete({ ...keys, id: row.id });
  }
}
