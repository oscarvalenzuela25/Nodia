import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { actorReference } from '../authorization/authority-transaction.js';
import {
  CreateSaleDto,
  CheckoutSaleDto,
  UpdateSaleDto,
  TransitionSaleDto,
  CancelSaleDto,
} from './dto/sale-command.dto.js';
import { QuerySalesDto } from './dto/query-sales.dto.js';
import { MutateSaleUseCase } from './use-case/mutate-sale.use-case.js';
import { ReadSalesUseCase } from './use-case/read-sales.use-case.js';

@Controller('businesses/:businessId')
export class SaleController {
  constructor(
    private readonly mutate: MutateSaleUseCase,
    private readonly read: ReadSalesUseCase,
  ) {}
  @Get('sales/reports/summary') summary(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query() query: QuerySalesDto,
    @Req() req: AuthRequest,
  ) {
    return this.read.summary(businessId, query, actorReference(req.auth));
  }
  @Get('sales/reports/top-products') top(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query() query: QuerySalesDto,
    @Req() req: AuthRequest,
  ) {
    return this.read.topProducts(businessId, query, actorReference(req.auth));
  }
  @Get('sale-mutation-requests/:key') receipt(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('key', ParseUUIDPipe) key: string,
    @Req() req: AuthRequest,
  ) {
    return this.read.receipt(businessId, key, actorReference(req.auth));
  }
  @Get('sales') list(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query() query: QuerySalesDto,
    @Req() req: AuthRequest,
  ) {
    return this.read.list(businessId, query, actorReference(req.auth));
  }
  @Get('sales/:id') get(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
  ) {
    return this.read.get(businessId, id, actorReference(req.auth));
  }
  @Post('sales') create(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() body: CreateSaleDto,
    @Req() req: AuthRequest,
  ) {
    return this.mutate.execute(
      businessId,
      'create',
      body,
      actorReference(req.auth),
    );
  }
  @Post('sales/checkout') checkout(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() body: CheckoutSaleDto,
    @Req() req: AuthRequest,
  ) {
    return this.mutate.execute(
      businessId,
      'checkout',
      body,
      actorReference(req.auth),
    );
  }
  @Put('sales/:id') update(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateSaleDto,
    @Req() req: AuthRequest,
  ) {
    return this.mutate.execute(
      businessId,
      'update',
      { ...body, sale_id: id },
      actorReference(req.auth),
    );
  }
  @Post('sales/:id/complete') complete(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TransitionSaleDto,
    @Req() req: AuthRequest,
  ) {
    return this.mutate.execute(
      businessId,
      'complete',
      { ...body, sale_id: id },
      actorReference(req.auth),
    );
  }
  @Post('sales/:id/cancel') cancel(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CancelSaleDto,
    @Req() req: AuthRequest,
  ) {
    return this.mutate.execute(
      businessId,
      'cancel',
      { ...body, sale_id: id },
      actorReference(req.auth),
    );
  }
  @Delete('sales/:id') discard(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TransitionSaleDto,
    @Req() req: AuthRequest,
  ) {
    return this.mutate.execute(
      businessId,
      'discard',
      { ...body, sale_id: id },
      actorReference(req.auth),
    );
  }
}
