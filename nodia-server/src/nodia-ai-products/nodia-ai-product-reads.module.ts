import { Module, type DynamicModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { readFileSync } from 'node:fs';
import type { NodiaAiToolFamily } from '../nodia-ai-tools/types/tool-registry.types.js';
import { parseNodiaAiStrictJson } from '../nodia-ai-context/strict-json.js';
import { NodiaAiFinanceReadModule } from './finance/finance-read.module.js';
import { NODIA_AI_FINANCE_READ_FAMILY } from './finance/finance-read.family.js';
import { NodiaAiReservationsModule } from './reservations/nodia-ai-reservations.module.js';
import { NodiaAiReservationsFamilyUseCase } from './reservations/use-case/nodia-ai-reservations-family.use-case.js';
import { createNodiaAiBusinessToolFamily } from './business/business-tool-family.js';
import { createNodiaAiSalesToolFamily } from './business/sales-tool-family.js';
import { SaleModule } from '../sale/sale.module.js';
import { ReadSalesUseCase } from '../sale/use-case/read-sales.use-case.js';
import { createNodiaAiAiSettingsReadFamily } from './ai-settings/ai-settings-read.family.js';
import { NodiaAiCoreSettingsReadModule } from './core-settings/core-settings-read.module.js';
import { NODIA_AI_CORE_SETTINGS_READ_FAMILY } from './core-settings/core-settings-read.family.js';
import { ComposeNodiaAiReadFamiliesUseCase } from './use-case/compose-nodia-ai-read-families.use-case.js';
import { NodiaAiExternalReadsModule } from './external/external-reads.module.js';
import {
  NODIA_AI_EXTERNAL_READ_FAMILY,
  NODIA_AI_EXTERNAL_READS,
} from './external/external-read.family.js';
import {
  createNodiaAiArtifactsFamily,
  NODIA_AI_ARTIFACT_CAPABILITIES,
} from './artifacts/artifacts.family.js';
import { NodiaAiArtifactsModule } from './artifacts/nodia-ai-artifacts.module.js';
import { Business } from '../business/entities/business.entity.js';
import { BusinessCollaborator } from '../business/entities/business-collaborator.entity.js';
import { BusinessAction } from '../business-action/entities/business-action.entity.js';
import { Product } from '../product/entities/product.entity.js';
import { ProductLog } from '../product/entities/product-log.entity.js';
import { Provider } from '../provider/entities/provider.entity.js';
import { ProviderContact } from '../provider-contact/entities/provider-contact.entity.js';
import { Invoice } from '../invoice/entities/invoice.entity.js';
import { UserRole } from '../user/entities/user-role.entity.js';
import { Translation } from '../translation/entities/translation.entity.js';
import { AiProvider } from '../ai-provider/entities/ai-provider.entity.js';
import { AiApiKey } from '../ai-provider/entities/ai-api-key.entity.js';
import { AiProviderCatalog } from '../ai-provider/entities/ai-provider-catalog.entity.js';
import { AiProviderEvent } from '../ai-provider/entities/ai-provider-event.entity.js';

export const NODIA_AI_CANDIDATE_READ_FAMILIES = Symbol(
  'NODIA_AI_CANDIDATE_READ_FAMILIES',
);

/** Metadata selects explicit typed exports; it never resolves classes or executes endpoints. */
export function selectPublishedNodiaAiFamilies(
  candidates: readonly NodiaAiToolFamily[],
  ids: readonly string[],
): readonly NodiaAiToolFamily[] {
  return new ComposeNodiaAiReadFamiliesUseCase().execute(candidates, ids);
}

export function compiledNodiaAiCapabilityIds(): readonly string[] {
  const manifest = parseNodiaAiStrictJson(
    readFileSync(
      new URL('../nodia-ai/knowledge/manifest.json', import.meta.url),
      'utf8',
    ),
  );
  if (
    !manifest ||
    typeof manifest !== 'object' ||
    Array.isArray(manifest) ||
    !('capability_contracts' in manifest) ||
    !Array.isArray(manifest.capability_contracts)
  )
    throw new Error('nodia_ai:knowledge_release_invalid');
  return manifest.capability_contracts.map((value) => {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      typeof value.capability_id !== 'string'
    )
      throw new Error('nodia_ai:knowledge_release_invalid');
    return value.capability_id;
  });
}

@Module({})
export class NodiaAiProductReadsModule {
  /** Empty unpublished builds do not instantiate domain readers or add Redis connections to the worker. */
  static forPublication(
    ids: readonly string[] = compiledNodiaAiCapabilityIds(),
  ): DynamicModule {
    if (ids.length === 0)
      return {
        module: NodiaAiProductReadsModule,
        providers: [
          { provide: NODIA_AI_CANDIDATE_READ_FAMILIES, useValue: [] },
        ],
        exports: [NODIA_AI_CANDIDATE_READ_FAMILIES],
      };
    const business = createNodiaAiBusinessToolFamily(
      readFileSync(
        new URL('./contracts/business.schema.json', import.meta.url),
        'utf8',
      ),
    );
    const aiSettings = createNodiaAiAiSettingsReadFamily();
    const artifacts = createNodiaAiArtifactsFamily();
    const published = new Set(ids);
    const requiresBusiness = [
      ...business.capabilities,
      ...artifacts.capabilities,
    ].some((capability) => published.has(capability.capabilityId));
    const requiresAiSettings =
      aiSettings.capabilities.some((capability) =>
        published.has(capability.capabilityId),
      ) || NODIA_AI_EXTERNAL_READS.some(([id]) => published.has(id));
    // These adapters intentionally construct native services with the checkpoint manager.
    // Register their repository/relationship metadata without importing legacy module consumers.
    const entities = [
      ...(requiresBusiness
        ? [
            Business,
            BusinessCollaborator,
            BusinessAction,
            Product,
            ProductLog,
            Provider,
            ProviderContact,
            Invoice,
            UserRole,
            Translation,
          ]
        : []),
      ...(requiresAiSettings
        ? [
            AiProvider,
            AiApiKey,
            AiProviderCatalog,
            AiProviderEvent,
            Translation,
          ]
        : []),
    ];
    return {
      module: NodiaAiProductReadsModule,
      imports: [
        ...(entities.length
          ? [TypeOrmModule.forFeature([...new Set(entities)])]
          : []),
        NodiaAiFinanceReadModule,
        NodiaAiReservationsModule,
        NodiaAiCoreSettingsReadModule,
        ...(ids.some(
          (id) => id === 'nodia_sales_get' || id === 'nodia_sales_list',
        )
          ? [SaleModule]
          : []),
        ...(NODIA_AI_EXTERNAL_READS.some(([id]) => ids.includes(id))
          ? [NodiaAiExternalReadsModule]
          : []),
        ...(NODIA_AI_ARTIFACT_CAPABILITIES.some(([operation]) =>
          ids.includes(`nodia_${operation}`),
        )
          ? [NodiaAiArtifactsModule]
          : []),
      ],
      providers: [
        {
          provide: NODIA_AI_CANDIDATE_READ_FAMILIES,
          inject: [
            NODIA_AI_FINANCE_READ_FAMILY,
            NodiaAiReservationsFamilyUseCase,
            NODIA_AI_CORE_SETTINGS_READ_FAMILY,
            { token: NODIA_AI_EXTERNAL_READ_FAMILY, optional: true },
            { token: ReadSalesUseCase, optional: true },
          ],
          useFactory: (
            finance: NodiaAiToolFamily,
            reservations: NodiaAiReservationsFamilyUseCase,
            core: NodiaAiToolFamily,
            external?: NodiaAiToolFamily,
            sales?: ReadSalesUseCase,
          ) =>
            selectPublishedNodiaAiFamilies(
              [
                finance,
                reservations.family(),
                core,
                business,
                ...(sales
                  ? [
                      createNodiaAiSalesToolFamily(
                        readFileSync(
                          new URL(
                            './contracts/sales.schema.json',
                            import.meta.url,
                          ),
                          'utf8',
                        ),
                        sales,
                      ),
                    ]
                  : []),
                aiSettings,
                ...(external ? [external] : []),
                artifacts,
              ],
              ids,
            ),
        },
      ],
      exports: [NODIA_AI_CANDIDATE_READ_FAMILIES],
    };
  }
}
