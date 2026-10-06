import { rentalResponseSchema } from '../rental-common/rental-response.schemas.js';
import { RentalMutationResultDto } from '../rental-common/dto/rental-mutation-result.dto.js';
import {
  Body,
  Controller,
  Get,
  Post,
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
import { CreateRentalPaymentUseCase } from './use-case/create-rental-payment.use-case.js';
import {
  GetRentalPaymentsUseCase,
  GetRentalPaymentUseCase,
} from './use-case/get-rental-payments.use-case.js';
import { VoidRentalPaymentUseCase } from './use-case/void-rental-payment.use-case.js';
import {
  CreateRentalPaymentDto,
  RentalPaymentQueryDto,
  VoidRentalPaymentDto,
} from './dto/rental-payment.dto.js';
@ApiTags('Rental - payment')
@ApiBearerAuth()
@ApiBadRequestResponse({ description: 'Invalid rental command or query' })
@ApiNotFoundResponse({ description: 'Missing record or inaccessible house' })
@ApiConflictResponse({
  description: 'Availability, state, money or idempotency conflict',
})
@UseGuards(RentalTransportGuard)
@Controller('rental/properties/:propertyId/payments')
export class RentalPaymentController {
  constructor(
    private readonly createRentalPaymentUseCase: CreateRentalPaymentUseCase,
    private readonly getRentalPaymentsUseCase: GetRentalPaymentsUseCase,
    private readonly getRentalPaymentUseCase: GetRentalPaymentUseCase,
    private readonly voidRentalPaymentUseCase: VoidRentalPaymentUseCase,
  ) {}
  @Post()
  @ApiOperation({ summary: 'CreateRentalPayment' })
  @ApiCreatedResponse({
    type: RentalMutationResultDto,
    description: 'Persisted acknowledgement; replay returns original result',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID v4 for this intent; preserve on retry',
  })
  createRentalPayment(
    @Req() request: AuthRequest,
    @Param() params: RentalPropertyParamsDto,
    @Body() dto: CreateRentalPaymentDto,
    @Headers('idempotency-key') requestKey: string,
  ) {
    return this.createRentalPaymentUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      dto,
      requestKey,
    );
  }
  @Get()
  @ApiOperation({ summary: 'GetRentalPayments' })
  @SetMetadata('rental:query', true)
  @ApiOkResponse({ schema: rentalResponseSchema('payment', true) })
  getRentalPayments(
    @Req() request: AuthRequest,
    @Param() params: RentalPropertyParamsDto,
    @Query() dto: RentalPaymentQueryDto,
  ) {
    return this.getRentalPaymentsUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      dto,
    );
  }
  @Get(':id')
  @ApiOperation({ summary: 'GetRentalPayment' })
  @ApiOkResponse({ schema: rentalResponseSchema('payment', false) })
  getRentalPayment(
    @Req() request: AuthRequest,
    @Param() params: RentalResourceParamsDto,
  ) {
    return this.getRentalPaymentUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      params.id,
    );
  }
  @Post(':id/void')
  @ApiOperation({ summary: 'VoidRentalPayment' })
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
  voidRentalPayment(
    @Req() request: AuthRequest,
    @Param() params: RentalResourceParamsDto,
    @Body() dto: VoidRentalPaymentDto,
    @Headers('idempotency-key') requestKey: string,
  ) {
    return this.voidRentalPaymentUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      params.id,
      dto,
      requestKey,
    );
  }
}
