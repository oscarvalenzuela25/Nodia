import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsInt,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsUtf8Text } from './nodia-ai-validation.js';

export class NodiaAiTextPartDto {
  @Equals('text') kind!: 'text';
  @IsUtf8Text(32768) text!: string;
}
export class NodiaAiImagePartDto {
  @Equals('image') kind!: 'image';
  @IsUUID('4') attachment_id!: string;
}
export class NodiaAiPdfPartDto {
  @Equals('pdf') kind!: 'pdf';
  @IsUUID('4') attachment_id!: string;
}
export class NodiaAiAudioPartDto {
  @Equals('audio') kind!: 'audio';
  @IsUUID('4') attachment_id!: string;
}
export type NodiaAiInputPart =
  | NodiaAiTextPartDto
  | NodiaAiImagePartDto
  | NodiaAiPdfPartDto
  | NodiaAiAudioPartDto;
/** Binary objects are uploaded separately; messages contain private same-chat references only. */
export class CreateNodiaAiMessageDto {
  @IsUUID('4') client_message_id!: string;
  @IsInt() @Min(1) @Max(2147483647) expected_conversation_revision!: number;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => NodiaAiTextPartDto, {
    discriminator: {
      property: 'kind',
      subTypes: [
        { name: 'text', value: NodiaAiTextPartDto },
        { name: 'image', value: NodiaAiImagePartDto },
        { name: 'pdf', value: NodiaAiPdfPartDto },
        { name: 'audio', value: NodiaAiAudioPartDto },
      ],
    },
    keepDiscriminatorProperty: true,
  })
  parts!: NodiaAiInputPart[];
}
