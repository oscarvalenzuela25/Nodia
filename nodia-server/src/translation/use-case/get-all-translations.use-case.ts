import { Injectable } from '@nestjs/common';
import { GetTranslationsDto } from '../dto/get-translations.dto.js';
import { TranslationService } from '../translation.service.js';

@Injectable()
export class GetAllTranslationsUseCase {
  constructor(private readonly translationService: TranslationService) {}

  async execute(dto: GetTranslationsDto) {
    return this.translationService.findAll(dto);
  }
}
