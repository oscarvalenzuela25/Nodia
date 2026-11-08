import { IsIn, IsOptional } from 'class-validator';
export class CodexSessionDto {
  @IsOptional()
  @IsIn(['agentic'])
  mode?: 'agentic';
}
