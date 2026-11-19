import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { PersonalNewsConnection } from './entities/personal-news-connection.entity.js';
import type { PersonalNewsProvider } from './personal-news.types.js';

@Injectable()
export class PersonalNewsService {
  async clock(manager: EntityManager): Promise<Date> {
    const [row]: { now: Date }[] = await manager.query(
      'SELECT clock_timestamp() AS now',
    );
    return row.now;
  }

  find(
    manager: EntityManager,
    owner: string,
    provider: PersonalNewsProvider,
  ): Promise<PersonalNewsConnection | null> {
    return manager.getRepository(PersonalNewsConnection).findOneBy({
      user_id: owner,
      provider,
    });
  }

  lock(
    manager: EntityManager,
    owner: string,
    provider: PersonalNewsProvider,
  ): Promise<PersonalNewsConnection | null> {
    return manager
      .getRepository(PersonalNewsConnection)
      .createQueryBuilder('connection')
      .addSelect('connection.credential_ciphertext')
      .where(
        'connection.user_id = :owner AND connection.provider = :provider',
        {
          owner,
          provider,
        },
      )
      .setLock('pessimistic_write')
      .getOne();
  }

  async create(
    manager: EntityManager,
    owner: string,
    provider: PersonalNewsProvider,
    version: string,
  ): Promise<void> {
    await manager.query(
      `INSERT INTO news_personal_connections(user_id, provider, credential_version)
       VALUES ($1, $2, $3) ON CONFLICT (user_id, provider) DO NOTHING`,
      [owner, provider, version],
    );
  }

  async save(
    manager: EntityManager,
    row: PersonalNewsConnection,
  ): Promise<void> {
    await manager.getRepository(PersonalNewsConnection).save(row);
  }

  async delete(
    manager: EntityManager,
    owner: string,
    provider: PersonalNewsProvider,
  ): Promise<void> {
    await manager.getRepository(PersonalNewsConnection).delete({
      user_id: owner,
      provider,
    });
  }
}
