import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../../authorization/authorization.module.js';
import { DeliverProviderVisitsUseCase } from './deliver-provider-visits.use-case.js';
import { ProviderVisitDeliveryWorker } from './provider-visit-delivery.worker.js';
import { WebPushDeliveryStore } from './web-push-delivery.store.js';
import { WebPushTransport } from './web-push-transport.js';

@Module({
  imports: [AuthorizationModule],
  providers: [
    WebPushDeliveryStore,
    WebPushTransport,
    DeliverProviderVisitsUseCase,
    ProviderVisitDeliveryWorker,
  ],
})
export class ProviderVisitDeliveryModule {}
