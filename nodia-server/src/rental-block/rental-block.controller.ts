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
import { CreateRentalBlockUseCase } from './use-case/create-rental-block.use-case.js';
import {
  GetRentalBlocksUseCase,
  GetRentalBlockUseCase,
} from './use-case/get-rental-blocks.use-case.js';
import { UpdateRentalBlockUseCase } from './use-case/update-rental-block.use-case.js';
import {
  CreateRentalBlockDto,
  RentalBlockQueryDto,
  UpdateRentalBlockDto,
} from './dto/rental-block.dto.js';
@ApiTags('Rental - block')
@ApiBearerAuth()
@ApiBadRequestResponse({ description: 'Invalid rental command or query' })
@ApiNotFoundResponse({ description: 'Missing record or inaccessible house' })
@ApiConflictResponse({
  description: 'Availability, state, money or idempotency conflict',
})
@UseGuards(RentalTransportGuard)
@Controller('rental/properties/:propertyId/blocks')
export class RentalBlockController {
  constructor(
    private readonly createRentalBlockUseCase: CreateRentalBlockUseCase,
    private readonly getRentalBlocksUseCase: GetRentalBlocksUseCase,
    private readonly getRentalBlockUseCase: GetRentalBlockUseCase,
    private readonly updateRentalBlockUseCase: UpdateRentalBlockUseCase,
  ) {}
  @Post()
  @ApiOperation({ summary: 'CreateRentalBlock' })
  @ApiCreatedResponse({
    type: RentalMutationResultDto,
    description: 'Persisted acknowledgement; replay returns original result',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID v4 for this intent; preserve on retry',
  })
  createRentalBlock(
    @Req() request: AuthRequest,
    @Param() params: RentalPropertyParamsDto,
    @Body() dto: CreateRentalBlockDto,
    @Headers('idempotency-key') requestKey: string,
  ) {
    return this.createRentalBlockUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      dto,
      requestKey,
    );
  }
  @Get()
  @ApiOperation({ summary: 'GetRentalBlocks' })
  @SetMetadata('rental:query', true)
  @ApiOkResponse({ schema: rentalResponseSchema('block', true) })
  getRentalBlocks(
    @Req() request: AuthRequest,
    @Param() params: RentalPropertyParamsDto,
    @Query() dto: RentalBlockQueryDto,
  ) {
    return this.getRentalBlocksUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      dto,
    );
  }
  @Get(':id')
  @ApiOperation({ summary: 'GetRentalBlock' })
  @ApiOkResponse({ schema: rentalResponseSchema('block', false) })
  getRentalBlock(
    @Req() request: AuthRequest,
    @Param() params: RentalResourceParamsDto,
  ) {
    return this.getRentalBlockUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      params.id,
    );
  }
  @Put(':id')
  @ApiOperation({ summary: 'UpdateRentalBlock' })
  @ApiOkResponse({
    type: RentalMutationResultDto,
    description: 'Persisted acknowledgement; replay returns original result',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID v4 for this intent; preserve on retry',
  })
  updateRentalBlock(
    @Req() request: AuthRequest,
    @Param() params: RentalResourceParamsDto,
    @Body() dto: UpdateRentalBlockDto,
    @Headers('idempotency-key') requestKey: string,
  ) {
    return this.updateRentalBlockUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      params.id,
      dto,
      requestKey,
    );
  }
}
