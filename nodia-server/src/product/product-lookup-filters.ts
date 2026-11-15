import { BadRequestException } from '@nestjs/common';
import type { SelectQueryBuilder } from 'typeorm';
import type { Product } from './entities/product.entity.js';

export type ProductCodePresence = 'present' | 'missing';
type Filters = { search?: unknown; code_presence?: unknown; barcode_presence?: unknown };
// Match String.trim() for identifiers pasted from invoices, including NBSP and BOM.
const identifierWhitespace = '\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff';

/** This fixed public surface is separate from literal name/code Ransack predicates. */
export function applyProductLookupFilters(qb: Pick<SelectQueryBuilder<Product>, 'andWhere'>, filters: Filters): void {
  if (filters.search !== undefined) {
    if (typeof filters.search !== 'string' || Array.from(filters.search).length > 255)
      throw new BadRequestException('product:invalid_search');
    const search = filters.search.trim();
    if (search) qb.andWhere('(product.name ILIKE :productSearch OR product.alias ILIKE :productSearch)', {
      productSearch: `%${search.replace(/[\\%_]/g, '\\$&')}%`,
    });
  }
  for (const field of ['code', 'barcode'] as const) {
    const presence = filters[`${field}_presence`];
    if (presence === undefined) continue;
    if (presence !== 'present' && presence !== 'missing') throw new BadRequestException('product:invalid_code_presence');
    qb.andWhere(`NULLIF(BTRIM(product.${field}, :productIdentifierWhitespace), '') IS ${presence === 'present' ? 'NOT ' : ''}NULL`,
      { productIdentifierWhitespace: identifierWhitespace });
  }
}
