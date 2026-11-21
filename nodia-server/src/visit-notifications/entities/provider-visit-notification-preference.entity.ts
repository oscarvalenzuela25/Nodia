import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('provider_visit_notification_preferences')
export class ProviderVisitNotificationPreference {
  @PrimaryColumn({ type: 'bigint' }) user_id!: string;
  @PrimaryColumn({ type: 'uuid' }) business_id!: string;
  @Column({ type: 'boolean', default: false }) enabled!: boolean;
}
