import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { NodiaAiReportRegistryUseCase } from './nodia-ai-report-registry.use-case.js';
import { NodiaAiReportQueryError } from './compile-nodia-ai-report.use-case.js';

/** Only currently authorized logical metadata leaves this boundary. */
@Injectable()
export class DescribeNodiaAiReportsUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly registry: NodiaAiReportRegistryUseCase,
    private readonly authorize: AuthorizeNodiaAiUseCase,
  ) {}
  async execute(
    identity: NodiaAiActorReference,
    value: unknown = {},
    existingManager?: EntityManager,
  ) {
    const input = this.registry.validate('describe', value);
    const modules = input.module_keys as string[] | undefined;
    if (input.cursor !== undefined)
      throw new NodiaAiReportQueryError('invalid_input', 'cursor');
    const sources = this.registry
      .list()
      .filter((source) => this.registry.isPublished(source.sourceKey))
      .filter((source) => !modules || modules.includes(source.moduleKey));
    const work = async (manager: EntityManager) => {
      if (!manager.queryRunner?.isTransactionActive)
        throw new NodiaAiReportQueryError('invalid_input', 'transaction');
      await lockAuthority(manager);
      const [isolation]: { transaction_isolation: string }[] =
        await manager.query('SHOW transaction_isolation');
      if (isolation?.transaction_isolation !== 'read committed')
        throw new NodiaAiReportQueryError(
          'invalid_input',
          'transaction_isolation',
        );
      const { allowed } = await this.authorize.filterAuthorized(
        identity,
        sources.map((source) => ({
          moduleRoutes: source.requiredModuleRoutes,
        })),
        manager,
      );
      return {
        catalog_version: this.registry.catalogVersion,
        sources: sources
          .filter((_, index) => allowed[index])
          .map((source) => structuredClone(source.descriptor)),
        next_cursor: null,
      };
    };
    return existingManager
      ? work(existingManager)
      : this.dataSource.transaction('READ COMMITTED', work);
  }
}
