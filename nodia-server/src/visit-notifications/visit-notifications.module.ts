import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { ProviderVisitNotificationPreference } from './entities/provider-visit-notification-preference.entity.js';
import { WebPushInstallation } from './entities/web-push-installation.entity.js';
import { BusinessVisitPreferenceUseCase } from './use-case/business-visit-preference.use-case.js';
import { WebPushInstallationUseCase } from './use-case/web-push-installation.use-case.js';
import {
  BusinessVisitPreferencesController,
  WebPushInstallationsController,
} from './visit-notifications.controller.js';
import { VisitNotificationsService } from './visit-notifications.service.js';

@Module({
  imports: [
    AuthorizationModule,
    TypeOrmModule.forFeature([
      ProviderVisitNotificationPreference,
      WebPushInstallation,
    ]),
  ],
  controllers: [
    BusinessVisitPreferencesController,
    WebPushInstallationsController,
  ],
  providers: [
    VisitNotificationsService,
    BusinessVisitPreferenceUseCase,
    WebPushInstallationUseCase,
  ],
})
export class VisitNotificationsModule {}
