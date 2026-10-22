import { IsInt, IsObject, IsOptional, IsUUID, Max, Min } from 'class-validator';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';

/** Never consumed by proposal, MCP or a model. The use case validates each closed payload. */
export class NodiaAiSecureFlowActionDto {
  @IsInt() @Min(1) @Max(2147483646) expected_execution_revision!: number;
  @IsUUID('4') client_request_id!: string;
  @IsOptional() @IsObject() payload?: NodiaAiJsonObject;
}
