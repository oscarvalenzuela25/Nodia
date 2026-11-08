import { Module } from '@nestjs/common';
import { ApiProviderService } from './api-provider.service.js';

/** One shared API OCR transport instance for Products and the NodiaAI coordinator. */
@Module({ providers: [ApiProviderService], exports: [ApiProviderService] })
export class ApiProviderModule {}
