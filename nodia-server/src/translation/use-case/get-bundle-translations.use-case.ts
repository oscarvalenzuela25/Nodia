import { Injectable } from '@nestjs/common';
import { TranslationService } from '../translation.service.js';

@Injectable()
export class GetBundleTranslationsUseCase {
  constructor(private readonly translationService: TranslationService) {}

  async execute(locale: string) {
    return this.translationService.getBundle(locale);
  }
}
