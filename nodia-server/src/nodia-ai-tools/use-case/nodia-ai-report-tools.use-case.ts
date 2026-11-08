import { moduleRouteIncluded } from '../../authorization/canonical-module-route.js';
import { Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import type { EntityManager } from 'typeorm';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import {
  canonicalKnowledge,
  knowledgeHash,
} from '../../nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case.js';
import { NodiaAiReportRegistryUseCase } from '../../nodia-ai-reports/use-case/nodia-ai-report-registry.use-case.js';
import { DescribeNodiaAiReportsUseCase } from '../../nodia-ai-reports/use-case/describe-nodia-ai-reports.use-case.js';
import { ComposeNodiaAiReportUseCase } from '../../nodia-ai-reports/use-case/compose-nodia-ai-report.use-case.js';
import { compileNodiaAiToolSchema } from './nodia-ai-tool-registry.use-case.js';

export const NODIA_AI_REPORT_TOOL_NAMES = [
  'nodia_reports_describe',
  'nodia_reports_run',
] as const;

/** Technical read ports, independently versioned from published product knowledge. */
@Injectable()
export class NodiaAiReportToolsUseCase {
  private readonly common = readFileSync(
    new URL('../config/common-schema.json', import.meta.url),
    'utf8',
  );
  private readonly output = readFileSync(
    new URL(
      '../../nodia-ai-reports/config/report-composition.schema.json',
      import.meta.url,
    ),
    'utf8',
  );
  constructor(
    private readonly registry: NodiaAiReportRegistryUseCase,
    private readonly describe: DescribeNodiaAiReportsUseCase,
    private readonly compose: ComposeNodiaAiReportUseCase,
  ) {}
  handles(name: string) {
    return (NODIA_AI_REPORT_TOOL_NAMES as readonly string[]).includes(name);
  }
  descriptors() {
    return NODIA_AI_REPORT_TOOL_NAMES.map((name, index) => ({
      name,
      description:
        index === 0
          ? 'Describe authorized logical report sources, exact measures, fields, temporal bases and limitations. No SQL or writes.'
          : 'Read exact filtered aggregates across described Nodia sources. Preserve source totals separately; compare only verified compatible meanings. Failed sources are unknown. No writes or arbitrary SQL. Use the catalog_version from nodia_reports_describe.',
      inputSchema: compileNodiaAiToolSchema({
        sourceJson: this.common,
        definition: index === 0 ? 'ReportDescribeInput' : 'ReportQueryInput',
        sha256: knowledgeHash(this.common),
      }).schema,
    }));
  }
  contractHash(name: string) {
    const descriptor = this.descriptors().find((item) => item.name === name);
    if (!descriptor) throw new Error('nodia_ai:capability_denied');
    return knowledgeHash(
      canonicalKnowledge({
        descriptor,
        source_catalog: this.registry.catalogVersion,
        output: this.output,
      }),
    );
  }
  validateInput(name: string, value: unknown) {
    if (!this.handles(name)) throw new Error('nodia_ai:capability_denied');
    return this.registry.validate(
      name === 'nodia_reports_run' ? 'query' : 'describe',
      value,
    );
  }
  assertGranted(input: NodiaAiJsonObject, routes: readonly string[]) {
    if (!Array.isArray(input.sources)) return;
    for (const request of input.sources) {
      if (
        !request ||
        typeof request !== 'object' ||
        Array.isArray(request) ||
        typeof request.source_key !== 'string'
      )
        throw new Error('nodia_ai:invalid_tool_input');
      if (
        !this.registry
          .get(request.source_key)
          .requiredModuleRoutes.every((route) => moduleRouteIncluded(routes, route))
      )
        throw new Error('nodia_ai:capability_denied');
    }
  }
  async execute(
    identity: NodiaAiActorReference,
    name: string,
    input: NodiaAiJsonObject,
    options?: {
      signal?: AbortSignal;
      deadlineAt?: number;
      allowedModuleRoutes?: readonly string[];
    },
  ) {
    if (!this.handles(name)) throw new Error('nodia_ai:capability_denied');
    return name === 'nodia_reports_run'
      ? this.compose.validateResult(
          await this.compose.execute(identity, input, options),
          input,
        )
      : this.filterDescription(
          (await this.describe.execute(
            identity,
            input,
          )) as unknown as NodiaAiJsonObject,
          options?.allowedModuleRoutes,
        );
  }
  private filterDescription(
    value: NodiaAiJsonObject,
    routes?: readonly string[],
  ) {
    if (!routes || !Array.isArray(value.sources))
      throw new Error('nodia_ai:capability_denied');
    return {
      ...value,
      sources: value.sources.filter(
        (source) =>
          source &&
          typeof source === 'object' &&
          !Array.isArray(source) &&
          typeof source.source_key === 'string' &&
          this.registry
            .get(source.source_key)
            .requiredModuleRoutes.every((route) => moduleRouteIncluded(routes, route)),
      ),
    };
  }
  async verifyResult(
    identity: NodiaAiActorReference,
    name: string,
    input: NodiaAiJsonObject,
    result: NodiaAiJsonObject,
    manager: EntityManager,
    routes?: readonly string[],
    originalActorId: string = identity.userId,
  ) {
    if (name !== 'nodia_reports_run') {
      // Catalog replay is rebuilt from current authority; revoked source descriptors cannot escape.
      const current = this.filterDescription(
        (await this.describe.execute(
          identity,
          input,
          manager,
        )) as unknown as NodiaAiJsonObject,
        routes,
      );
      if (canonicalKnowledge(current) !== canonicalKnowledge(result))
        throw new Error('nodia_ai:catalog_changed');
      return;
    }
    const checked = this.compose.validateResult(result, input);
    if (!Array.isArray(checked.source_results) || !Array.isArray(input.sources))
      throw new Error('nodia_ai:invalid_tool_output');
    const aliases = checked.source_results.map((item) =>
      item && typeof item === 'object' && !Array.isArray(item)
        ? item.source_alias
        : null,
    );
    const sources = input.sources
      .filter(
        (item) =>
          item &&
          typeof item === 'object' &&
          !Array.isArray(item) &&
          aliases.includes(item.alias),
      )
      .map((item) => {
        const request = item as NodiaAiJsonObject;
        const block = checked.source_results as NodiaAiJsonObject[];
        const resultSource = block.find(
          (source) => source.source_alias === request.alias,
        )!;
        const scope = resultSource.scope as NodiaAiJsonObject;
        const requestedScope = request.scope as NodiaAiJsonObject;
        if (
          this.registry.get(request.source_key as string).scope.kind ===
            'personal' &&
          scope.subject_user_id !==
            (requestedScope.subject_user_id ?? originalActorId)
        )
          throw new Error('nodia_ai:invalid_tool_output');
        return { ...request, scope };
      });
    if (sources.length !== aliases.length)
      throw new Error('nodia_ai:invalid_tool_output');
    if (sources.length)
      await this.compose.verifyAuthority(
        identity,
        {
          catalog_version: input.catalog_version,
          combine: 'separate',
          sources,
        },
        manager,
      );
  }
}
