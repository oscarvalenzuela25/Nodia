import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { NodiaAiReportToolsUseCase } from './nodia-ai-report-tools.use-case.js';
import type { NodiaAiReportRegistryUseCase } from '../../nodia-ai-reports/use-case/nodia-ai-report-registry.use-case.js';
import type { DescribeNodiaAiReportsUseCase } from '../../nodia-ai-reports/use-case/describe-nodia-ai-reports.use-case.js';
import type { ComposeNodiaAiReportUseCase } from '../../nodia-ai-reports/use-case/compose-nodia-ai-report.use-case.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';

function fixture() {
  const registry = {
    catalogVersion: 'a'.repeat(64),
    validate: vi.fn((_kind, input) => input),
    get: vi.fn(() => ({
      requiredModuleRoutes: ['/tools/finance'],
      scope: { kind: 'personal' },
    })),
  };
  const describe = {
    execute: vi.fn(async () => ({
      catalog_version: registry.catalogVersion,
      sources: [{ source_key: 'finance_movements' }],
      next_cursor: null,
    })),
  };
  const compose = {
    execute: vi.fn(),
    validateResult: vi.fn((value) => value),
    verifyAuthority: vi.fn(async () => {}),
  };
  const subject = new NodiaAiReportToolsUseCase(
    registry as unknown as NodiaAiReportRegistryUseCase,
    describe as unknown as DescribeNodiaAiReportsUseCase,
    compose as unknown as ComposeNodiaAiReportUseCase,
  );
  const input: NodiaAiJsonObject = {
    catalog_version: registry.catalogVersion,
    combine: 'separate',
    sources: [
      {
        source_key: 'finance_movements',
        alias: 'personal',
        scope: {},
        measures: [
          {
            measure_key: 'confirmed_expense_amount',
            aggregation: 'sum',
            output_key: 'amount',
          },
        ],
      },
    ],
  };
  const result: NodiaAiJsonObject = {
    source_results: [
      {
        source_key: 'finance_movements',
        source_alias: 'personal',
        scope: { subject_user_id: '1' },
      },
    ],
  };
  const identity = { userId: '3', sessionId: 'synthetic-session' };
  return {
    subject,
    registry,
    describe,
    compose,
    input,
    result,
    identity,
    manager: {} as EntityManager,
  };
}
describe('NodiaAI report technical contracts and replay scope', () => {
  it('describes only modules frozen in the run grant, even if current access grew', async () => {
    const f = fixture();
    expect(
      await f.subject.execute(
        f.identity,
        'nodia_reports_describe',
        {},
        { allowedModuleRoutes: ['/tools/nodia-ai'] },
      ),
    ).toMatchObject({ sources: [] });
    expect(
      await f.subject.execute(
        f.identity,
        'nodia_reports_describe',
        {},
        { allowedModuleRoutes: ['/tools/finance'] },
      ),
    ).toMatchObject({ sources: [{ source_key: 'finance_movements' }] });
    expect(() => f.subject.assertGranted(f.input, ['/tools/nodia-ai'])).toThrow(
      'capability_denied',
    );
  });
  it('rejects unknown helper names instead of dispatching a catalog read', async () => {
    const f = fixture();
    await expect(f.subject.execute(f.identity, 'unknown', {})).rejects.toThrow(
      'capability_denied',
    );
    expect(f.describe.execute).not.toHaveBeenCalled();
  });
  it('rechecks the original resolved owner under a super_admin viewer without recomputing aggregates', async () => {
    const f = fixture();
    await f.subject.verifyResult(
      f.identity,
      'nodia_reports_run',
      f.input,
      f.result,
      f.manager,
      [],
      '1',
    );
    expect(f.compose.validateResult).toHaveBeenCalledWith(f.result, f.input);
    expect(f.compose.verifyAuthority).toHaveBeenCalledWith(
      f.identity,
      expect.objectContaining({
        sources: [expect.objectContaining({ scope: { subject_user_id: '1' } })],
      }),
      f.manager,
    );
    expect(f.compose.execute).not.toHaveBeenCalled();
  });
  it('rejects a stored scope substituted for the default owner before native reads', async () => {
    const f = fixture();
    await expect(
      f.subject.verifyResult(
        f.identity,
        'nodia_reports_run',
        f.input,
        f.result,
        f.manager,
        [],
        '2',
      ),
    ).rejects.toThrow('invalid_tool_output');
    expect(f.compose.verifyAuthority).not.toHaveBeenCalled();
  });
  it('binds each helper hash to the exact source registry and supplies closed object schemas', () => {
    const f = fixture();
    const before = f.subject.contractHash('nodia_reports_run');
    f.registry.catalogVersion = 'b'.repeat(64);
    expect(f.subject.contractHash('nodia_reports_run')).not.toBe(before);
    for (const descriptor of f.subject.descriptors())
      expect(descriptor.inputSchema).toMatchObject({
        type: 'object',
        additionalProperties: false,
      });
  });
});
