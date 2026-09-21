import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Provider } from './entities/provider.entity.js';
import { ProviderService } from './provider.service.js';
import { ProviderController } from './provider.controller.js';
import { GetAllProvidersUseCase } from './use-case/get-all-providers.use-case.js';
import { GetProviderByIdUseCase } from './use-case/get-provider-by-id.use-case.js';
import { CreateProviderUseCase } from './use-case/create-provider.use-case.js';
import { UpdateProviderUseCase } from './use-case/update-provider.use-case.js';

@Module({
  imports: [TypeOrmModule.forFeature([Provider])],
  controllers: [ProviderController],
  providers: [
    ProviderService,
    GetAllProvidersUseCase,
    GetProviderByIdUseCase,
    CreateProviderUseCase,
    UpdateProviderUseCase,
  ],
  exports: [ProviderService],
})
export class ProviderModule {}
