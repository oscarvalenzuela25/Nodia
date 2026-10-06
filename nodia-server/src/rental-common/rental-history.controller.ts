import { rentalResponseSchema } from './rental-response.schemas.js';
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
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { RentalAuditQueryDto } from '../rental-audit/dto/rental-audit-query.dto.js';
import { GetRentalAuditEventsUseCase } from '../rental-audit/use-case/get-rental-audit-events.use-case.js';
import { GetRentalOperationUseCase } from '../rental-operation/use-case/get-rental-operation.use-case.js';
import {
  RentalOperationParamsDto,
  RentalPropertyParamsDto,
} from './dto/rental-params.dto.js';
import { RentalTransportGuard } from './rental-transport.guard.js';
@ApiTags('Rental - history')
@ApiBearerAuth()
@UseGuards(RentalTransportGuard)
@Controller('rental/properties/:propertyId')
export class RentalHistoryController {
  constructor(
    private readonly audit: GetRentalAuditEventsUseCase,
    private readonly operation: GetRentalOperationUseCase,
  ) {}
  @Get('audit-events')
  @SetMetadata('rental:query', true)
  @ApiOperation({ summary: 'Get immutable house audit events' })
  @ApiOkResponse({ schema: rentalResponseSchema('audit', true) })
  history(
    @Req() request: AuthRequest,
    @Param() params: RentalPropertyParamsDto,
    @Query() query: RentalAuditQueryDto,
  ) {
    return this.audit.execute(request.auth.user.id, params.propertyId, query);
  }
  @Get('operations/:requestKey')
  @ApiOperation({ summary: 'Recover a confirmed intent owned by this actor' })
  @ApiOkResponse({ schema: rentalResponseSchema('operation') })
  recover(
    @Req() request: AuthRequest,
    @Param() params: RentalOperationParamsDto,
  ) {
    return this.operation.execute(
      request.auth.user.id,
      params.propertyId,
      params.requestKey,
    );
  }
}
