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
import { CreateRentalCollaboratorUseCase } from './use-case/create-rental-collaborator.use-case.js';
import { GetRentalCollaboratorCandidatesUseCase } from './use-case/get-rental-collaborator-candidates.use-case.js';
import { GetRentalCollaboratorsUseCase } from './use-case/get-rental-collaborators.use-case.js';
import { UpdateRentalCollaboratorUseCase } from './use-case/update-rental-collaborator.use-case.js';
import { CreateRentalCollaboratorDto } from './dto/create-rental-collaborator.dto.js';
import {
  RentalCollaboratorCandidatesQueryDto,
  RentalConfigurationQueryDto,
} from '../rental-property/dto/rental-configuration-query.dto.js';
import { UpdateRentalCollaboratorDto } from './dto/update-rental-collaborator.dto.js';
@ApiTags('Rental - collaborator')
@ApiBearerAuth()
@ApiBadRequestResponse({ description: 'Invalid rental command or query' })
@ApiNotFoundResponse({ description: 'Missing record or inaccessible house' })
@ApiConflictResponse({
  description: 'Availability, state, money or idempotency conflict',
})
@UseGuards(RentalTransportGuard)
@Controller('rental/properties/:propertyId')
export class RentalCollaboratorController {
  constructor(
    private readonly createRentalCollaboratorUseCase: CreateRentalCollaboratorUseCase,
    private readonly getRentalCollaboratorCandidatesUseCase: GetRentalCollaboratorCandidatesUseCase,
    private readonly getRentalCollaboratorsUseCase: GetRentalCollaboratorsUseCase,
    private readonly updateRentalCollaboratorUseCase: UpdateRentalCollaboratorUseCase,
  ) {}
  @Post('collaborators')
  @ApiOperation({ summary: 'CreateRentalCollaborator' })
  @ApiCreatedResponse({
    type: RentalMutationResultDto,
    description: 'Persisted acknowledgement; replay returns original result',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID v4 for this intent; preserve on retry',
  })
  createRentalCollaborator(
    @Req() request: AuthRequest,
    @Param() params: RentalPropertyParamsDto,
    @Body() dto: CreateRentalCollaboratorDto,
    @Headers('idempotency-key') requestKey: string,
  ) {
    return this.createRentalCollaboratorUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      dto,
      requestKey,
    );
  }
  @Get('collaborator-candidates')
  @ApiOperation({ summary: 'GetRentalCollaboratorCandidates' })
  @SetMetadata('rental:query', true)
  @ApiOkResponse({ schema: rentalResponseSchema('candidate', true) })
  getRentalCollaboratorCandidates(
    @Req() request: AuthRequest,
    @Param() params: RentalPropertyParamsDto,
    @Query() dto: RentalCollaboratorCandidatesQueryDto,
  ) {
    return this.getRentalCollaboratorCandidatesUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      dto,
    );
  }
  @Get('collaborators')
  @ApiOperation({ summary: 'GetRentalCollaborators' })
  @SetMetadata('rental:query', true)
  @ApiOkResponse({ schema: rentalResponseSchema('collaborator', true) })
  getRentalCollaborators(
    @Req() request: AuthRequest,
    @Param() params: RentalPropertyParamsDto,
    @Query() dto: RentalConfigurationQueryDto,
  ) {
    return this.getRentalCollaboratorsUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      dto,
    );
  }
  @Put('collaborators/:id')
  @ApiOperation({ summary: 'UpdateRentalCollaborator' })
  @ApiOkResponse({
    type: RentalMutationResultDto,
    description: 'Persisted acknowledgement; replay returns original result',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID v4 for this intent; preserve on retry',
  })
  updateRentalCollaborator(
    @Req() request: AuthRequest,
    @Param() params: RentalResourceParamsDto,
    @Body() dto: UpdateRentalCollaboratorDto,
    @Headers('idempotency-key') requestKey: string,
  ) {
    return this.updateRentalCollaboratorUseCase.execute(
      request.auth.user.id,
      params.propertyId,
      params.id,
      dto,
      requestKey,
    );
  }
}
