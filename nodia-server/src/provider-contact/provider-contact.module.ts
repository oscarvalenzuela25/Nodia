import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Provider } from '../provider/entities/provider.entity.js';
import { ProviderContact } from './entities/provider-contact.entity.js';
import { ProviderContactService } from './provider-contact.service.js';
import { ProviderContactController } from './provider-contact.controller.js';
import { CreateProviderContactUseCase } from './use-case/create-provider-contact.use-case.js';
import { GetProviderContactsUseCase } from './use-case/get-provider-contacts.use-case.js';
import { UpdateProviderContactUseCase } from './use-case/update-provider-contact.use-case.js';
@Module({
  imports: [TypeOrmModule.forFeature([Provider, ProviderContact])],
  controllers: [ProviderContactController],
  providers: [
    ProviderContactService,
    CreateProviderContactUseCase,
    GetProviderContactsUseCase,
    UpdateProviderContactUseCase,
  ],
})
export class ProviderContactModule {}
