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
import { RentalPropertyParamsDto } from '../rental-common/dto/rental-params.dto.js';
import { RentalTransportGuard } from '../rental-common/rental-transport.guard.js';
import { CreateRentalPropertyUseCase } from './use-case/create-rental-property.use-case.js';
import { GetRentalPropertiesUseCase } from './use-case/get-rental-properties.use-case.js';
import { GetRentalPropertyUseCase } from './use-case/get-rental-property.use-case.js';
import { UpdateRentalPropertyUseCase } from './use-case/update-rental-property.use-case.js';
import { CreateRentalPropertyDto } from './dto/create-rental-property.dto.js';
import { RentalConfigurationQueryDto } from './dto/rental-configuration-query.dto.js';
import { UpdateRentalPropertyDto } from './dto/update-rental-property.dto.js';
@ApiTags('Rental - property')
@ApiBearerAuth()
@ApiBadRequestResponse({ description: 'Invalid rental command or query' })
@ApiNotFoundResponse({ description: 'Missing record or inaccessible house' })
@ApiConflictResponse({
  description: 'Availability, state, money or idempotency conflict',
})
@UseGuards(RentalTransportGuard)
@Controller('rental/properties')
export class RentalPropertyController {
  constructor(
    private readonly createRentalPropertyUseCase: CreateRentalPropertyUseCase,
    private readonly getRentalPropertiesUseCase: GetRentalPropertiesUseCase,
    private readonly getRentalPropertyUseCase: GetRentalPropertyUseCase,
    private readonly updateRentalPropertyUseCase: UpdateRentalPropertyUseCase,
  ) {}
  @Post()
  @ApiOperation({ summary: 'CreateRentalProperty' })
  @ApiCreatedResponse({
    type: RentalMutationResultDto,
    description: 'Persisted acknowledgement; replay returns original result',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID v4 for this intent; preserve on retry',
  })
  createRentalProperty(
    @Req() request: AuthRequest,
    @Body() dto: CreateRentalPropertyDto,
    @Headers('idempotency-key') requestKey: string,
  ) {
    return this.createRentalPropertyUseCase.execute(
      request.auth.user.id,
      dto,
      requestKey,
    );
  }
  @Get()
  @ApiOperation({ summary: 'GetRentalProperties' })
  @SetMetadata('rental:query', true)
  @ApiOkResponse({ schema: rentalResponseSchema('property', true) })
  getRentalProperties(
    @Req() request: AuthRequest,
    @Query() dto: RentalConfigurationQueryDto,
  ) {
    return this.getRentalPropertiesUseCase.execute(request.auth.user.id, dto);
  }
  @Get(':propertyId')
  @ApiOperation({ summary: 'GetRentalProperty' })
  @ApiOkResponse({ schema: rentalResponseSchema('property', false) })
  getRentalProperty(
    @Req() request: AuthRequest,
    @Param() params: RentalPropertyParamsDto,
  ) {
    return this.getRentalPropertyUseCase.execute(
      request.auth.user.id,
      params.propertyId,
    );
  }
  @Put(':propertyId')
  @ApiOperation({ summary: 'UpdateRentalProperty' })
  @ApiOkResponse({
    type: RentalMutationResultDto,
    description: 'Persisted acknowledgement; replay returns original result',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID v4 for this intent; preserve on retry',
  })
  updateRentalProperty(
    @Req() request: AuthRequest,
    @Param() params: RentalPropertyParamsDto,
    @Body() dto: UpdateRentalPropertyDto,
    @Headers('idempotency-key') requestKey: string,
  ) {
    return this.updateRentalPropertyUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      dto,
      requestKey,
    );
  }
}
