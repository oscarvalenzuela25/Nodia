import { IsIn, IsInt, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { GEMINI_LOGIN_KEYS, type GeminiLoginInput } from '../../common/ai/gemini-login-viewer.js';

export class GeminiLoginInputDto implements GeminiLoginInput {
  @IsString() @Matches(/^[0-9a-f]{32}$/) @MaxLength(32)
  frame_id: string;

  @IsIn(['click', 'text', 'key', 'scroll'])
  action: GeminiLoginInput['action'];

  @ValidateIf((dto: GeminiLoginInputDto) => dto.action === 'click' || dto.x !== undefined)
  @IsInt() @Min(0) @Max(1279)
  x?: number;

  @ValidateIf((dto: GeminiLoginInputDto) => dto.action === 'click' || dto.y !== undefined)
  @IsInt() @Min(0) @Max(849)
  y?: number;

  @ValidateIf((dto: GeminiLoginInputDto) => dto.action === 'text' || dto.text !== undefined)
  @IsString() @MinLength(1) @MaxLength(2048)
  text?: string;

  @ValidateIf((dto: GeminiLoginInputDto) => dto.action === 'key' || dto.key !== undefined)
  @IsIn(GEMINI_LOGIN_KEYS)
  key?: string;

  @ValidateIf((dto: GeminiLoginInputDto) => dto.action === 'scroll' || dto.delta !== undefined)
  @IsInt() @Min(-600) @Max(600)
  delta?: number;
}
