import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { EnrichmentOperation } from '../types/teacher-enrichment.types.js';
export class TeacherEnrichmentCommandDto {
  @IsInt() @Min(0) @Max(2147483646) expected_revision!: number;
  @IsIn([
    'card_create',
    'review_rate',
    'thread_create',
    'thread_message',
    'source_create',
    'activity_create',
    'activity_respond',
    'concept_create',
    'equivalence_set',
    'visual_create',
  ])
  operation!: EnrichmentOperation;
  @IsObject() payload!: Record<string, unknown>;
}
export class TeacherEnrichmentConceptQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1;
  @IsOptional() @IsString() @Length(0, 120) q?: string;
}
