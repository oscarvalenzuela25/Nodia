import { Column, Entity, PrimaryColumn } from 'typeorm';

export type WebPushInstallationState = 'active' | 'revoked' | 'expired';

@Entity('web_push_installations')
export class WebPushInstallation {
  @PrimaryColumn({ type: 'bigint' }) user_id!: string;
  @PrimaryColumn({ type: 'uuid' }) installation_id!: string;
  @Column({ type: 'uuid' }) session_id!: string;
  @Column({ type: 'text' }) state!: WebPushInstallationState;
  @Column({ type: 'integer' }) revision!: number;
  @Column({ type: 'varchar', length: 64, nullable: true }) key_id!:
    string | null;
  @Column({ type: 'varchar', length: 64, nullable: true, select: false })
  endpoint_fingerprint!: string | null;
  @Column({ type: 'varchar', length: 64, nullable: true, select: false })
  subscription_fingerprint!: string | null;
  @Column({ type: 'text', nullable: true, select: false })
  subscription_ciphertext!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) expires_at!: Date | null;
  @Column({ type: 'timestamptz', default: () => 'clock_timestamp()' })
  updated_at!: Date;
}
