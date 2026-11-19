import { Column, Entity, PrimaryColumn } from 'typeorm';
import type {
  PersonalNewsArticle,
  PersonalNewsProvider,
  PersonalNewsProviderErrorCode,
  PersonalNewsRetrySource,
  PersonalNewsSnapshotStatus,
  PersonalNewsState,
} from '../personal-news.types.js';

@Entity('news_personal_connections')
export class PersonalNewsConnection {
  @PrimaryColumn({ type: 'bigint' }) user_id!: string;
  @PrimaryColumn({ type: 'text' }) provider!: PersonalNewsProvider;
  @Column({ type: 'uuid' }) credential_version!: string;
  @Column({ type: 'text', nullable: true, select: false })
  credential_ciphertext!: string | null;
  @Column({ type: 'text', default: 'disconnected' }) state!: Exclude<
    PersonalNewsState,
    'pending'
  >;
  @Column({ type: 'varchar', length: 80, nullable: true }) account_name!:
    string | null;
  @Column({ type: 'timestamptz', nullable: true }) last_tested_at!: Date | null;
  @Column({ type: 'text', nullable: true })
  last_test_error_code!: PersonalNewsProviderErrorCode | null;
  @Column({ type: 'timestamptz', nullable: true })
  last_refresh_attempt_at!: Date | null;
  @Column({ type: 'timestamptz', nullable: true })
  last_refresh_success_at!: Date | null;
  @Column({ type: 'text', nullable: true })
  last_refresh_error_code!: PersonalNewsProviderErrorCode | null;
  @Column({ type: 'timestamptz', nullable: true })
  next_refresh_at!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) retry_until!: Date | null;
  @Column({ type: 'text', nullable: true })
  retry_source!: PersonalNewsRetrySource | null;
  @Column({ type: 'timestamptz', nullable: true })
  snapshot_expires_at!: Date | null;
  @Column({ type: 'text', nullable: true })
  snapshot_status!: PersonalNewsSnapshotStatus | null;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  articles!: PersonalNewsArticle[];
  @Column({ type: 'uuid', nullable: true }) operation_lease_id!: string | null;
  @Column({ type: 'timestamptz', nullable: true })
  operation_lease_until!: Date | null;
  @Column({ type: 'uuid', nullable: true }) connect_lease_id!: string | null;
  @Column({ type: 'timestamptz', nullable: true })
  connect_lease_until!: Date | null;
}
