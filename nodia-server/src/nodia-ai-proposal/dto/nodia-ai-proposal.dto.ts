import { Transform, Type } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
export class NodiaAiProposalQueryDto {
  @ValidateIf((_target, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && /^[1-9][0-9]*$/.test(value)
      ? Number(value)
      : value,
  )
  @IsInt()
  @Min(1)
  @Max(2147483647)
  revision?: number;
}
/** Nested closed schemas and registered field keys are validated by the application use case. */
export class NodiaAiProposalFieldEditDto {
  @IsUUID('4') step_id!: string;
  @IsString() field_key!: string;
  @Allow() value!: unknown;
}
export class UpdateNodiaAiProposalDto {
  @IsInt() @Min(1) @Max(2147483647) expected_proposal_revision!: number;
  @IsString() @Matches(/^[a-f0-9]{64}$/) expected_hash!: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NodiaAiProposalFieldEditDto)
  edits!: NodiaAiProposalFieldEditDto[];
}
export class CancelNodiaAiProposalDto {
  @IsUUID('4') client_request_id!: string;
  @IsInt() @Min(1) @Max(2147483647) expected_proposal_revision!: number;
}
