import { IsIn, IsOptional } from 'class-validator';
export class CodexSessionDto {
  @IsOptional()
  @IsIn(['token_plan_agentic'])
  mode?: 'token_plan_agentic';
}
