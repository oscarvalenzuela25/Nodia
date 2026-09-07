import { PartialType } from '@nestjs/swagger';
import { CreateTranslationDto } from './create-translation.dto.js';

export class UpdateTranslationDto extends PartialType(CreateTranslationDto) {}
