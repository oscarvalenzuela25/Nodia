import { Column, Entity, PrimaryColumn } from 'typeorm';

/** M1 storage shape. Constraints and referential integrity are frozen in migration1792200000000. */
@Entity('nodia_ai_runtime_slots')
export class NodiaAiRuntimeSlot {
  @PrimaryColumn({ type: 'text' })
  resource_key!: string;

  @Column({ type: 'text' })
  state!: string;

  @Column({ type: 'uuid', nullable: true })
  conversation_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  job_id!: string | null;

  // Read by neutral owner stores with explicit SQL; legacy ORM projections stay compatible.
  generation_operation_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  holder_worker_id!: string | null;

  @Column({ type: 'bigint', default: '0' })
  fence!: string;

  @Column({ type: 'timestamptz', nullable: true })
  lease_until!: Date | null;

  @Column({ type: 'text', nullable: true })
  external_operation_ref!: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updated_at!: Date;
}
