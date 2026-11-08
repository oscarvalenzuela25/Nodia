import { IsIn, IsOptional } from 'class-validator';

/** Read-only observation of one explicitly selected channel; does not change defaults. */
export class VerifyIaProvidersQueryDto {
  @IsOptional()
  @IsIn(['agentic', 'api_key'])
  mode?: 'agentic' | 'api_key';
}
