import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Translation } from './entities/translation.entity.js';
import { TranslationService } from './translation.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Translation])],
  controllers: [],
  providers: [TranslationService],
  exports: [TranslationService, TypeOrmModule],
})
export class TranslationModule {}

