import { rentalResponseSchema } from '../rental-common/rental-response.schemas.js';
import { RentalMutationResultDto } from '../rental-common/dto/rental-mutation-result.dto.js';
import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Headers,
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
import { CreateRentalCancellationPolicyUseCase } from './use-case/create-rental-cancellation-policy.use-case.js';
import { GetRentalCancellationPoliciesUseCase } from './use-case/get-rental-cancellation-policies.use-case.js';
import { GetRentalCancellationPolicyUseCase } from './use-case/get-rental-cancellation-policy.use-case.js';
import { UpdateRentalCancellationPolicyUseCase } from './use-case/update-rental-cancellation-policy.use-case.js';
import { CreateRentalCancellationPolicyDto } from './dto/create-rental-cancellation-policy.dto.js';
import { RentalConfigurationQueryDto } from '../rental-property/dto/rental-configuration-query.dto.js';
import { UpdateRentalCancellationPolicyDto } from './dto/update-rental-cancellation-policy.dto.js';
@ApiTags('Rental - cancellation-policy')
@ApiBearerAuth()
@ApiBadRequestResponse({ description: 'Invalid rental command or query' })
@ApiNotFoundResponse({ description: 'Missing record or inaccessible house' })
@ApiConflictResponse({
  description: 'Availability, state, money or idempotency conflict',
})
@UseGuards(RentalTransportGuard)
@Controller('rental/properties/:propertyId/cancellation-policies')
export class RentalCancellationPolicyController {
  constructor(
    private readonly createRentalCancellationPolicyUseCase: CreateRentalCancellationPolicyUseCase,
    private readonly getRentalCancellationPoliciesUseCase: GetRentalCancellationPoliciesUseCase,
    private readonly getRentalCancellationPolicyUseCase: GetRentalCancellationPolicyUseCase,
    private readonly updateRentalCancellationPolicyUseCase: UpdateRentalCancellationPolicyUseCase,
  ) {}
  @Post()
  @ApiOperation({ summary: 'CreateRentalCancellationPolicy' })
  @ApiCreatedResponse({
    type: RentalMutationResultDto,
    description: 'Persisted acknowledgement; replay returns original result',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID v4 for this intent; preserve on retry',
  })
  createRentalCancellationPolicy(
    @Req() request: AuthRequest,
    @Param() params: RentalPropertyParamsDto,
    @Body() dto: CreateRentalCancellationPolicyDto,
    @Headers('idempotency-key') requestKey: string,
  ) {
    return this.createRentalCancellationPolicyUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      dto,
      requestKey,
    );
  }
  @Get()
  @ApiOperation({ summary: 'GetRentalCancellationPolicies' })
  @SetMetadata('rental:query', true)
  @ApiOkResponse({ schema: rentalResponseSchema('policy', true) })
  getRentalCancellationPolicies(
    @Req() request: AuthRequest,
    @Param() params: RentalPropertyParamsDto,
    @Query() dto: RentalConfigurationQueryDto,
  ) {
    return this.getRentalCancellationPoliciesUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      dto,
    );
  }
  @Get(':id')
  @ApiOperation({ summary: 'GetRentalCancellationPolicy' })
  @ApiOkResponse({ schema: rentalResponseSchema('policy', false) })
  getRentalCancellationPolicy(
    @Req() request: AuthRequest,
    @Param() params: RentalResourceParamsDto,
  ) {
    return this.getRentalCancellationPolicyUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      params.id,
    );
  }
  @Put(':id')
  @ApiOperation({ summary: 'UpdateRentalCancellationPolicy' })
  @ApiOkResponse({
    type: RentalMutationResultDto,
    description: 'Persisted acknowledgement; replay returns original result',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID v4 for this intent; preserve on retry',
  })
  updateRentalCancellationPolicy(
    @Req() request: AuthRequest,
    @Param() params: RentalResourceParamsDto,
    @Body() dto: UpdateRentalCancellationPolicyDto,
    @Headers('idempotency-key') requestKey: string,
  ) {
    return this.updateRentalCancellationPolicyUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      params.id,
      dto,
      requestKey,
    );
  }
}
