import { rentalResponseSchema } from '../rental-common/rental-response.schemas.js';
import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { RentalPropertyParamsDto } from '../rental-common/dto/rental-params.dto.js';
import { RentalTransportGuard } from '../rental-common/rental-transport.guard.js';
import { GetRentalOverviewUseCase } from './use-case/get-rental-overview.use-case.js';
import { RentalOverviewQueryDto } from './dto/rental-overview.dto.js';
@ApiTags('Rental - overview')
@ApiBearerAuth()
@ApiBadRequestResponse({ description: 'Invalid rental command or query' })
@ApiNotFoundResponse({ description: 'Missing record or inaccessible house' })
@ApiConflictResponse({
  description: 'Availability, state, money or idempotency conflict',
})
@UseGuards(RentalTransportGuard)
@Controller('rental/properties/:propertyId/overview')
export class RentalOverviewController {
  constructor(
    private readonly getRentalOverviewUseCase: GetRentalOverviewUseCase,
  ) {}
  @Get()
  @ApiOperation({ summary: 'GetRentalOverview' })
  @SetMetadata('rental:query', true)
  @ApiOkResponse({ schema: rentalResponseSchema('overview', false) })
  getRentalOverview(
    @Req() request: AuthRequest,
    @Param() params: RentalPropertyParamsDto,
    @Query() dto: RentalOverviewQueryDto,
  ) {
    return this.getRentalOverviewUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      dto,
    );
  }
}
