import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { compileNodiaAiToolSchema } from '../../nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';
import { buildNodiaAiLocalReceipt } from '../../nodia-ai-proposal/types/local-operation.types.js';
import type {
  ProposalPreparerContext,
  StoredProposalStep,
} from '../../nodia-ai-proposal/types/proposal-preparer.types.js';
import {
  BuildNodiaAiSalesOperationsUseCase,
  NodiaAiSalesOperation,
  SALE_OPERATIONS,
} from './build-nodia-ai-sales-operations.use-case.js';

const business = '11111111-1111-4111-8111-111111111111';
const sale = '22222222-2222-4222-8222-222222222222';
const hashes = {
  create: '89b6b5503767595ff60c689f1ca239fb252ee0ab8a7b8860bf86744ab1f7e394',
  update: 'a69f82d971c7cdfdf7da6308864706087bfafcd38dc09740782ed3f5686655e0',
  complete: '948dd52ada1be789c94eaa3f87c31b91792adadaa967234ca856226243cd0731',
  cancel: 'ba9ad08fab46e15c8c0df2a282c42836dea6863d3b89893d1cdd3a0693a9b784',
  discard: 'e56a3d3be7252d974457d102a2d2f529a11e2c1afe3aa7ae36fc23e7cf055e39',
};

describe('Retired NodiaAI sales identity and receipts', () => {
  it.each(SALE_OPERATIONS)(
    'denies every active path of legacy %s without reading or writing domain data',
    async (operation) => {
      const writer = { execute: vi.fn() };
      const op = new NodiaAiSalesOperation(operation, writer);
      const step = {} as StoredProposalStep,
        context = {} as ProposalPreparerContext;
      expect(op.contractHash).toBe(hashes[operation]);
      expect(op.toolName).toBe(`nodia_sales_prepare_${operation}`);
      for (const action of [
        () => op.prepare({ business_id: business }, context),
        () => op.reprepareStored({}, context),
        () => op.applyEdits({}, [], context),
        () => op.verifyAuthority(step, context),
        () => op.verifyPreconditions(step, context),
        () => op.executeConfirmed(step, context),
      ])
        await expect(action()).rejects.toThrow('nodia_ai:catalog_changed');
      expect(writer.execute).not.toHaveBeenCalled();
      expect(new BuildNodiaAiSalesOperationsUseCase(writer).operations).toEqual(
        [],
      );
    },
  );

  it('preserves the closed historical sale receipt format without enabling a preparation or effect', () => {
    const sourceJson = readFileSync(
      new URL(
        '../../nodia-ai-tools/config/common-schema.json',
        import.meta.url,
      ),
      'utf8',
    );
    const receiptSchema = compileNodiaAiToolSchema({
      sourceJson,
      definition: 'BusinessEffectReceipt',
      sha256: createHash('sha256').update(sourceJson).digest('hex'),
    });
    const receipt = buildNodiaAiLocalReceipt(
      {
        tool_name: 'nodia_sales_prepare_create',
        command_template: { id: null },
        scope: { business_id: business },
        preconditions: { destination_business_id: business },
      },
      { id: sale, businessId: business },
      (_definition, value) => {
        if (!receiptSchema.validate(value)) throw new Error('Invalid witness');
      },
    );
    expect(receipt).toEqual({
      schema_version: 1,
      resource_key: 'sales',
      operation: 'create',
      resource_id: sale,
      business_id: business,
    });
    expect(
      receiptSchema.validate({
        ...receipt,
        resource_key: 'invoices',
        operation: 'complete',
      }),
    ).toBe(false);
    expect(receiptSchema.validate({ ...receipt, resource_id: '1' })).toBe(
      false,
    );
  });
});
