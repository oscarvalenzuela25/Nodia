import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Translation } from './entities/translation.entity.js';
import { TranslationController } from './translation.controller.js';
import { TranslationService } from './translation.service.js';
import { GetAllTranslationsUseCase } from './use-case/get-all-translations.use-case.js';
import { GetBundleTranslationsUseCase } from './use-case/get-bundle-translations.use-case.js';
import { CreateTranslationUseCase } from './use-case/create-translation.use-case.js';
import { UpdateTranslationUseCase } from './use-case/update-translation.use-case.js';

@Module({
  imports: [TypeOrmModule.forFeature([Translation])],
  controllers: [TranslationController],
  providers: [
    TranslationService,
    GetAllTranslationsUseCase,
    GetBundleTranslationsUseCase,
    CreateTranslationUseCase,
    UpdateTranslationUseCase,
  ],
  exports: [TranslationService],
})
export class TranslationModule {}
