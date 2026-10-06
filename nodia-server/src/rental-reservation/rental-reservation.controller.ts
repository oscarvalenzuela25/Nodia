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
  ApiCreatedResponse,
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
import { CancelRentalReservationUseCase } from './use-case/cancel-rental-reservation.use-case.js';
import { CompleteRentalReservationUseCase } from './use-case/complete-rental-reservation.use-case.js';
import { ConfirmRentalReservationUseCase } from './use-case/confirm-rental-reservation.use-case.js';
import { CreateRentalReservationUseCase } from './use-case/create-rental-reservation.use-case.js';
import { GetRentalReservationUseCase } from './use-case/get-rental-reservation.use-case.js';
import { ListRentalReservationUseCase } from './use-case/list-rental-reservation.use-case.js';
import { PreviewRentalCancellationUseCase } from './use-case/preview-rental-cancellation.use-case.js';
import { StartRentalReservationUseCase } from './use-case/start-rental-reservation.use-case.js';
import { UpdateRentalReservationUseCase } from './use-case/update-rental-reservation.use-case.js';
import {
  CancelRentalReservationDto,
  EmptyRentalCommandDto,
  ConfirmRentalReservationDto,
  PreviewRentalCancellationDto,
} from './dto/reservation-commands.dto.js';
import { CreateRentalReservationDto } from './dto/create-rental-reservation.dto.js';
import { RentalReservationQueryDto } from './dto/rental-reservation-query.dto.js';
import { UpdateRentalReservationDto } from './dto/update-rental-reservation.dto.js';
@ApiTags('Rental - reservation')
@ApiBearerAuth()
@ApiBadRequestResponse({ description: 'Invalid rental command or query' })
@ApiNotFoundResponse({ description: 'Missing record or inaccessible house' })
@ApiConflictResponse({
  description: 'Availability, state, money or idempotency conflict',
})
@UseGuards(RentalTransportGuard)
@Controller('rental/properties/:propertyId/reservations')
export class RentalReservationController {
  constructor(
    private readonly cancelRentalReservationUseCase: CancelRentalReservationUseCase,
    private readonly completeRentalReservationUseCase: CompleteRentalReservationUseCase,
    private readonly confirmRentalReservationUseCase: ConfirmRentalReservationUseCase,
    private readonly createRentalReservationUseCase: CreateRentalReservationUseCase,
    private readonly getRentalReservationUseCase: GetRentalReservationUseCase,
    private readonly listRentalReservationUseCase: ListRentalReservationUseCase,
    private readonly previewRentalCancellationUseCase: PreviewRentalCancellationUseCase,
    private readonly startRentalReservationUseCase: StartRentalReservationUseCase,
    private readonly updateRentalReservationUseCase: UpdateRentalReservationUseCase,
  ) {}
  @Post(':id/cancel')
  @ApiOperation({ summary: 'CancelRentalReservation' })
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
  cancelRentalReservation(
    @Req() request: AuthRequest,
    @Param() params: RentalResourceParamsDto,
    @Body() dto: CancelRentalReservationDto,
    @Headers('idempotency-key') requestKey: string,
  ) {
    return this.cancelRentalReservationUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      params.id,
      dto,
      requestKey,
    );
  }
  @Post(':id/complete')
  @ApiOperation({ summary: 'CompleteRentalReservation' })
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
  completeRentalReservation(
    @Req() request: AuthRequest,
    @Param() params: RentalResourceParamsDto,
    @Body() dto: EmptyRentalCommandDto,
    @Headers('idempotency-key') requestKey: string,
  ) {
    return this.completeRentalReservationUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      params.id,
      dto,
      requestKey,
    );
  }
  @Post(':id/confirm')
  @ApiOperation({ summary: 'ConfirmRentalReservation' })
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
  confirmRentalReservation(
    @Req() request: AuthRequest,
    @Param() params: RentalResourceParamsDto,
    @Body() dto: ConfirmRentalReservationDto,
    @Headers('idempotency-key') requestKey: string,
  ) {
    return this.confirmRentalReservationUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      params.id,
      dto,
      requestKey,
    );
  }
  @Post()
  @ApiOperation({ summary: 'CreateRentalReservation' })
  @ApiCreatedResponse({
    type: RentalMutationResultDto,
    description: 'Persisted acknowledgement; replay returns original result',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID v4 for this intent; preserve on retry',
  })
  createRentalReservation(
    @Req() request: AuthRequest,
    @Param() params: RentalPropertyParamsDto,
    @Body() dto: CreateRentalReservationDto,
    @Headers('idempotency-key') requestKey: string,
  ) {
    return this.createRentalReservationUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      dto,
      requestKey,
    );
  }
  @Get(':id')
  @ApiOperation({ summary: 'GetRentalReservation' })
  @ApiOkResponse({ schema: rentalResponseSchema('reservation', false) })
  getRentalReservation(
    @Req() request: AuthRequest,
    @Param() params: RentalResourceParamsDto,
  ) {
    return this.getRentalReservationUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      params.id,
    );
  }
  @Get()
  @ApiOperation({ summary: 'ListRentalReservation' })
  @SetMetadata('rental:query', true)
  @ApiOkResponse({ schema: rentalResponseSchema('reservation', true) })
  listRentalReservation(
    @Req() request: AuthRequest,
    @Param() params: RentalPropertyParamsDto,
    @Query() dto: RentalReservationQueryDto,
  ) {
    return this.listRentalReservationUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      dto,
    );
  }
  @Post(':id/cancellation-preview')
  @ApiOperation({ summary: 'PreviewRentalCancellation' })
  @HttpCode(200)
  @ApiOkResponse({ schema: rentalResponseSchema('cancellation', false) })
  previewRentalCancellation(
    @Req() request: AuthRequest,
    @Param() params: RentalResourceParamsDto,
    @Body() dto: PreviewRentalCancellationDto,
  ) {
    return this.previewRentalCancellationUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      params.id,
      dto,
    );
  }
  @Post(':id/start')
  @ApiOperation({ summary: 'StartRentalReservation' })
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
  startRentalReservation(
    @Req() request: AuthRequest,
    @Param() params: RentalResourceParamsDto,
    @Body() dto: EmptyRentalCommandDto,
    @Headers('idempotency-key') requestKey: string,
  ) {
    return this.startRentalReservationUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      params.id,
      dto,
      requestKey,
    );
  }
  @Put(':id')
  @ApiOperation({ summary: 'UpdateRentalReservation' })
  @ApiOkResponse({
    type: RentalMutationResultDto,
    description: 'Persisted acknowledgement; replay returns original result',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID v4 for this intent; preserve on retry',
  })
  updateRentalReservation(
    @Req() request: AuthRequest,
    @Param() params: RentalResourceParamsDto,
    @Body() dto: UpdateRentalReservationDto,
    @Headers('idempotency-key') requestKey: string,
  ) {
    return this.updateRentalReservationUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      params.id,
      dto,
      requestKey,
    );
  }
}
