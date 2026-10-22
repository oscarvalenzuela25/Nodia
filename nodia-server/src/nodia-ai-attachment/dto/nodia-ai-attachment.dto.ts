import { IsIn, IsInt, IsUUID, Min } from 'class-validator';
import { IsUtf8Text } from '../../nodia-ai-conversation/dto/nodia-ai-validation.js';
import type { NodiaAiAttachmentKind } from '../types/attachment-ports.js';

export class CreateNodiaAiAttachmentDto {
  @IsUUID('4') conversation_id!: string;
  @IsUUID('4') client_request_id!: string;
  @IsIn(['image', 'pdf', 'audio']) kind!: NodiaAiAttachmentKind;
  @IsInt() @Min(1) byte_count!: number;
  @IsUtf8Text(256) file_name!: string;
}
export class ReviewNodiaAiAttachmentDto {
  @IsUtf8Text(32768) text!: string;
  @IsInt() @Min(0) expected_revision!: number;
}
