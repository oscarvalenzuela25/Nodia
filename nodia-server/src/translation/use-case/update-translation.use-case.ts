import { Injectable } from '@nestjs/common';
import { UpdateTranslationDto } from '../dto/update-translation.dto.js';
import { TranslationService } from '../translation.service.js';

@Injectable()
export class UpdateTranslationUseCase {
  constructor(private readonly translationService: TranslationService) {}

  async execute(id: string, dto: UpdateTranslationDto) {
    return this.translationService.update(id, dto);
  }
}
