import { Column, Entity, PrimaryColumn } from 'typeorm';

/** M1 storage shape. Constraints and referential integrity are frozen in migration1792200000000. */
@Entity('nodia_ai_message_parts')
export class NodiaAiMessagePart {
  @PrimaryColumn({ type: 'uuid' })
  message_id!: string;

  @Column({ type: 'uuid' })
  conversation_id!: string;

  @PrimaryColumn({ type: 'integer' })
  part_index!: number;

  @Column({ type: 'text' })
  kind!: string;

  @Column({ type: 'text', nullable: true })
  text!: string | null;

  @Column({ type: 'uuid', nullable: true })
  attachment_id!: string | null;
}
