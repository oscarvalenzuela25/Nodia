import { Controller, Get, Header, Param, Req } from '@nestjs/common';
import { actorReference } from '../authorization/authority-transaction.js';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { CashReceiptParamsDto } from './dto/cash-category-params.dto.js';
import { ReadCashReceiptUseCase } from './use-case/read-cash-receipt.use-case.js';

@Controller('businesses/:businessId/cash-mutation-requests')
export class BusinessCashReceiptsController {
  constructor(private readonly read: ReadCashReceiptUseCase) {}

  @Get(':key')
  @Header('Cache-Control', 'no-store')
  receipt(@Param() params: CashReceiptParamsDto, @Req() request: AuthRequest) {
    return this.read.execute(
      params.businessId,
      params.key,
      actorReference(request.auth),
    );
  }
}
