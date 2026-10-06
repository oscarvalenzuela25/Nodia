import { rentalResponseSchema } from '../rental-common/rental-response.schemas.js';
import { RentalMutationResultDto } from '../rental-common/dto/rental-mutation-result.dto.js';
import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Headers,
  HttpCode,
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
  ApiHeader,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import type { AuthRequest } from '../auth/types/auth.types.js';
import {
  RentalPropertyParamsDto,
  RentalResourceParamsDto,
} from '../rental-common/dto/rental-params.dto.js';
import { RentalTransportGuard } from '../rental-common/rental-transport.guard.js';
import { ApproveSameDayRentalTurnoverUseCase } from './use-case/approve-same-day-rental-turnover.use-case.js';
import { GetRentalTurnoverUseCase } from './use-case/get-rental-turnover.use-case.js';
import { ListRentalTurnoverUseCase } from './use-case/list-rental-turnover.use-case.js';
import { UpdateRentalTurnoverUseCase } from './use-case/update-rental-turnover.use-case.js';
import { EmptyRentalCommandDto } from '../rental-reservation/dto/reservation-commands.dto.js';
import { RentalTurnoverQueryDto } from './dto/rental-turnover-query.dto.js';
import { UpdateRentalTurnoverDto } from './dto/update-rental-turnover.dto.js';
@ApiTags('Rental - turnover')
@ApiBearerAuth()
@ApiBadRequestResponse({ description: 'Invalid rental command or query' })
@ApiNotFoundResponse({ description: 'Missing record or inaccessible house' })
@ApiConflictResponse({
  description: 'Availability, state, money or idempotency conflict',
})
@UseGuards(RentalTransportGuard)
@Controller('rental/properties/:propertyId/turnovers')
export class RentalTurnoverController {
  constructor(
    private readonly approveSameDayRentalTurnoverUseCase: ApproveSameDayRentalTurnoverUseCase,
    private readonly getRentalTurnoverUseCase: GetRentalTurnoverUseCase,
    private readonly listRentalTurnoverUseCase: ListRentalTurnoverUseCase,
    private readonly updateRentalTurnoverUseCase: UpdateRentalTurnoverUseCase,
  ) {}
  @Post(':id/approve-same-day')
  @ApiOperation({ summary: 'ApproveSameDayRentalTurnover' })
  @HttpCode(200)
  @ApiOkResponse({
    type: RentalMutationResultDto,
    description: 'Persisted acknowledgement; replay returns original result',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID v4 for this intent; preserve on retry',
  })
  approveSameDayRentalTurnover(
    @Req() request: AuthRequest,
    @Param() params: RentalResourceParamsDto,
    @Body() dto: EmptyRentalCommandDto,
    @Headers('idempotency-key') requestKey: string,
  ) {
    return this.approveSameDayRentalTurnoverUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      params.id,
      dto,
      requestKey,
    );
  }
  @Get(':id')
  @ApiOperation({ summary: 'GetRentalTurnover' })
  @ApiOkResponse({ schema: rentalResponseSchema('turnover_detail', false) })
  getRentalTurnover(
    @Req() request: AuthRequest,
    @Param() params: RentalResourceParamsDto,
  ) {
    return this.getRentalTurnoverUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      params.id,
    );
  }
  @Get()
  @ApiOperation({ summary: 'ListRentalTurnover' })
  @SetMetadata('rental:query', true)
  @ApiOkResponse({ schema: rentalResponseSchema('turnover', true) })
  listRentalTurnover(
    @Req() request: AuthRequest,
    @Param() params: RentalPropertyParamsDto,
    @Query() dto: RentalTurnoverQueryDto,
  ) {
    return this.listRentalTurnoverUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      dto,
    );
  }
  @Put(':id')
  @ApiOperation({ summary: 'UpdateRentalTurnover' })
  @ApiOkResponse({
    type: RentalMutationResultDto,
    description: 'Persisted acknowledgement; replay returns original result',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID v4 for this intent; preserve on retry',
  })
  updateRentalTurnover(
    @Req() request: AuthRequest,
    @Param() params: RentalResourceParamsDto,
    @Body() dto: UpdateRentalTurnoverDto,
    @Headers('idempotency-key') requestKey: string,
  ) {
    return this.updateRentalTurnoverUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      params.id,
      dto,
      requestKey,
    );
  }
}
