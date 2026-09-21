import { PartialType } from '@nestjs/swagger';
import { CreateBusinessActionDto } from './create-business-action.dto.js';

export class UpdateBusinessActionDto extends PartialType(CreateBusinessActionDto) {}
