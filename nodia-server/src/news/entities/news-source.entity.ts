import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { NewsSourceKey, StoredNewsArticle } from '../news.types.js';

/** Bounded public cache, not a permanent article archive. */
@Entity('news_sources')
export class NewsSource {
  @PrimaryColumn({ type: 'text' }) source_key: NewsSourceKey;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  articles: StoredNewsArticle[];
  @Column({ type: 'text', array: true, default: () => "'{}'::text[]" })
  feed_ids: string[];
  @Column({ type: 'timestamptz', nullable: true }) last_attempt_at: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) last_success_at: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) next_refresh_at: Date | null;
  @Column({ type: 'text', nullable: true }) last_error_code: string | null;
  @Column({ type: 'text', nullable: true }) etag: string | null;
  @Column({ type: 'text', nullable: true }) last_modified: string | null;
  @Column({ type: 'uuid', nullable: true }) lease_token: string | null;
  @Column({ type: 'timestamptz', nullable: true }) lease_until: Date | null;
}
