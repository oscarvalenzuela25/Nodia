import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { NewsSource } from './entities/news-source.entity.js';
import { NEWS_SOURCE_KEYS } from './news.sources.js';
import type { NewsSourceKey } from './news.types.js';

/** Persistence only; authorization and refresh decisions live in the use case. */
@Injectable()
export class NewsService {
  constructor(private readonly dataSource: DataSource) {}
  async snapshot(
    manager: EntityManager = this.dataSource.manager,
    lock = false,
    sourceKey: NewsSourceKey = 'web-dev',
  ): Promise<NewsSource | null> {
    const query = manager
      .getRepository(NewsSource)
      .createQueryBuilder('source')
      .where('source.source_key = :key', { key: sourceKey });
    if (lock) query.setLock('pessimistic_write');
    return query.getOne();
  }
  async snapshots(): Promise<NewsSource[]> {
    return this.dataSource
      .getRepository(NewsSource)
      .createQueryBuilder('source')
      .where('source.source_key IN (:...keys)', { keys: NEWS_SOURCE_KEYS })
      .getMany();
  }
  async create(
    manager: EntityManager,
    sourceKey: NewsSourceKey,
  ): Promise<void> {
    await manager.query(
      'INSERT INTO news_sources(source_key) VALUES($1) ON CONFLICT DO NOTHING',
      [sourceKey],
    );
  }
  async save(manager: EntityManager, source: NewsSource): Promise<void> {
    await manager.getRepository(NewsSource).save(source);
  }
  async clock(manager: EntityManager): Promise<Date> {
    const [row]: { now: Date }[] = await manager.query(
      'SELECT clock_timestamp() AS now',
    );
    return row.now;
  }
}
