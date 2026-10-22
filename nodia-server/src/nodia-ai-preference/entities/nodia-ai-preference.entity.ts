import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type {
  NodiaAiPreferenceKey,
  NodiaAiPreferenceScopeKey,
} from '../types/preference.types.js';
@Entity('nodia_ai_preferences')
export class NodiaAiPreference {
  @PrimaryColumn({ type: 'uuid' }) id!: string;
  @Column({ type: 'bigint' }) owner_id!: string;
  @Column({ type: 'text' }) scope_key!: NodiaAiPreferenceScopeKey;
  @Column({ type: 'char', length: 64 }) scope_hash!: string;
  @Column({ type: 'jsonb' }) scope!: NodiaAiJsonObject;
  @Column({ type: 'text' }) key!: NodiaAiPreferenceKey;
  @Column({ type: 'jsonb' }) value!: string;
  @Column({ type: 'integer', default: 1 }) revision!: number;
  @Column({ type: 'uuid', nullable: true }) source_conversation_id!:
    string | null;
  @Column({ type: 'uuid', nullable: true }) accepted_step_id!: string | null;
  @Column({ type: 'timestamptz', default: () => 'now()' }) created_at!: Date;
  @Column({ type: 'timestamptz', default: () => 'now()' }) updated_at!: Date;
}
