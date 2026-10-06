import { FinanceQueryDto } from '../../finance-common/dto/finance-query.dto.js';

/** Overview accepts the same bounded movement filters as the movements table. */
export class FinanceOverviewQueryDto extends FinanceQueryDto {}

/** name_cont/key_cont search the catalogue; financial filters target movements. */
export class FinanceSummaryQueryDto extends FinanceQueryDto {}
