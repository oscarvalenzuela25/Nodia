import { IsOptional, ValidateNested } from 'class-validator';
import { InvoiceFilterDto } from './filter-invoice.dto.js';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export class GetInvoicesDto extends PaginationQueryDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => InvoiceFilterDto)
  q?: InvoiceFilterDto;
}
