import { PartialType } from '@nestjs/swagger';
import { CreateActionDto } from './create-action.dto.js';

export class UpdateActionDto extends PartialType(CreateActionDto) {}
