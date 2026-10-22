import { IsInt, IsString, IsUUID, Matches, Max, Min } from 'class-validator';
export class NodiaAiConfirmationChallengeDto {
  @IsInt() @Min(1) @Max(2147483647) proposal_revision!: number;
  @IsString() @Matches(/^[a-f0-9]{64}$/) expected_hash!: string;
}
export class ConfirmNodiaAiProposalDto extends NodiaAiConfirmationChallengeDto {
  @IsUUID('4') client_request_id!: string;
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/)
  confirmation_token!: string;
}
export class NodiaAiExecutionControlDto {
  @IsUUID('4') client_request_id!: string;
  @IsInt() @Min(1) @Max(2147483647) expected_execution_revision!: number;
}
