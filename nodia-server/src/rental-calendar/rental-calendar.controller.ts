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
import {
  GetRentalCalendarUseCase,
  GetRentalAvailabilityUseCase,
} from './use-case/get-rental-calendar.use-case.js';
import {
  RentalCalendarQueryDto,
  RentalAvailabilityQueryDto,
} from './dto/rental-calendar.dto.js';
@ApiTags('Rental - calendar')
@ApiBearerAuth()
@ApiBadRequestResponse({ description: 'Invalid rental command or query' })
@ApiNotFoundResponse({ description: 'Missing record or inaccessible house' })
@ApiConflictResponse({
  description: 'Availability, state, money or idempotency conflict',
})
@UseGuards(RentalTransportGuard)
@Controller('rental/properties/:propertyId')
export class RentalCalendarController {
  constructor(
    private readonly getRentalCalendarUseCase: GetRentalCalendarUseCase,
    private readonly getRentalAvailabilityUseCase: GetRentalAvailabilityUseCase,
  ) {}
  @Get('calendar')
  @ApiOperation({ summary: 'GetRentalCalendar' })
  @SetMetadata('rental:query', true)
  @ApiOkResponse({ schema: rentalResponseSchema('calendar', false) })
  getRentalCalendar(
    @Req() request: AuthRequest,
    @Param() params: RentalPropertyParamsDto,
    @Query() dto: RentalCalendarQueryDto,
  ) {
    return this.getRentalCalendarUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      dto,
    );
  }
  @Get('availability')
  @ApiOperation({ summary: 'GetRentalAvailability' })
  @SetMetadata('rental:query', true)
  @ApiOkResponse({ schema: rentalResponseSchema('availability', false) })
  getRentalAvailability(
    @Req() request: AuthRequest,
    @Param() params: RentalPropertyParamsDto,
    @Query() dto: RentalAvailabilityQueryDto,
  ) {
    return this.getRentalAvailabilityUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      dto,
    );
  }
}
