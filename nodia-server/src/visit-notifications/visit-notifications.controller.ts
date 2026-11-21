import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { actorReference } from '../authorization/authority-transaction.js';
import type { AuthRequest } from '../auth/types/auth.types.js';
import {
  BusinessVisitPreferenceParams,
  RevokeWebPushInstallationQuery,
  SaveBusinessVisitPreferenceDto,
  SaveWebPushInstallationDto,
  WebPushInstallationParams,
} from './dto/visit-notifications.dto.js';
import { BusinessVisitPreferenceUseCase } from './use-case/business-visit-preference.use-case.js';
import { WebPushInstallationUseCase } from './use-case/web-push-installation.use-case.js';
import { publicWebPushConfig } from './web-push-config.js';

@ApiTags('Provider visit notifications')
@Controller('businesses/:businessId/notification-preferences')
export class BusinessVisitPreferencesController {
  constructor(private readonly preferences: BusinessVisitPreferenceUseCase) {}

  @Get('provider-visits')
  @Header('Cache-Control', 'no-store')
  status(
    @Param() params: BusinessVisitPreferenceParams,
    @Req() req: AuthRequest,
  ) {
    return this.preferences.execute(
      params.businessId,
      actorReference(req.auth),
    );
  }

  @Put('provider-visits')
  save(
    @Param() params: BusinessVisitPreferenceParams,
    @Body() dto: SaveBusinessVisitPreferenceDto,
    @Req() req: AuthRequest,
  ) {
    return this.preferences.execute(
      params.businessId,
      actorReference(req.auth),
      dto.enabled,
    );
  }
}

@ApiTags('Web Push installations')
@Controller('notifications/web-push')
export class WebPushInstallationsController {
  constructor(private readonly installations: WebPushInstallationUseCase) {}

  @Get('config')
  @Header('Cache-Control', 'no-store')
  config() {
    return publicWebPushConfig();
  }

  @Get('installations/:installationId')
  @Header('Cache-Control', 'no-store')
  status(@Param() params: WebPushInstallationParams, @Req() req: AuthRequest) {
    return this.installations.execute(
      params.installationId,
      actorReference(req.auth),
      { kind: 'read' },
    );
  }

  @Put('installations/:installationId')
  save(
    @Param() params: WebPushInstallationParams,
    @Body() dto: SaveWebPushInstallationDto,
    @Req() req: AuthRequest,
  ) {
    return this.installations.execute(
      params.installationId,
      actorReference(req.auth),
      { kind: 'register', value: dto },
    );
  }

  @Delete('installations/:installationId')
  revoke(
    @Param() params: WebPushInstallationParams,
    @Query() query: RevokeWebPushInstallationQuery,
    @Req() req: AuthRequest,
  ) {
    return this.installations.execute(
      params.installationId,
      actorReference(req.auth),
      {
        kind: 'revoke',
        expectedRevision: Number(query.expected_revision),
      },
    );
  }
}
