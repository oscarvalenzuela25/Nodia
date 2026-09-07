import { Injectable } from '@nestjs/common';
import { CreateTranslationDto } from '../dto/create-translation.dto.js';
import { TranslationService } from '../translation.service.js';

@Injectable()
export class CreateTranslationUseCase {
  constructor(private readonly translationService: TranslationService) {}

  async execute(dto: CreateTranslationDto) {
    return this.translationService.create(dto);
  }
}
