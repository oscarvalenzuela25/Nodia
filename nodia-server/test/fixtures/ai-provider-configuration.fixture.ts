import { vi } from 'vitest';
import type { DataSource, EntityManager } from 'typeorm';
import type { ActorReference } from '../../src/authorization/authority-transaction.js';
import { AiProvider } from '../../src/ai-provider/entities/ai-provider.entity.js';
import { AiProviderCatalog } from '../../src/ai-provider/entities/ai-provider-catalog.entity.js';
import type { TranslationService } from '../../src/translation/translation.service.js';

export function configurationFixture() {
  const actor: ActorReference = {
    userId: '1',
    sessionId: '11111111-1111-4111-8111-111111111111',
  };
  const catalog = Object.assign(new AiProviderCatalog(), {
    id: '2',
    key: 'gemini',
    name: 'Synthetic provider',
    is_active: true,
    can_use_api_key: true,
    can_use_agentic: true,
  });
  const existing = Object.assign(new AiProvider(), {
    id: '9007199254740993',
    catalog_id: '2',
    catalog,
    fields: {
      legacy: { token: 'synthetic-private-value' },
      agentic: {
        selected_model: 'synthetic-model',
        secret: 'synthetic-mode-secret',
        thinking_levels: { 'synthetic-model': 'high', other: 'low' },
      },
    },
    use_api_key: false,
    use_agentic: true,
    default_mode: 'agentic',
    name: 'Historical connection',
    is_active: true,
    is_default: false,
  });
  const trace: string[] = [];
  const qb = {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    execute: vi.fn(async () => {
      trace.push('reset-default');
    }),
  };
  const providerRepo = {
    findOne: vi.fn(async () => {
      trace.push('provider-read');
      return existing;
    }),
    findOneOrFail: vi.fn(async () => existing),
    count: vi.fn(async () => 0),
    create: vi.fn((value: Partial<AiProvider>) =>
      Object.assign(new AiProvider(), value),
    ),
    save: vi.fn(async (value: AiProvider) => {
      trace.push('provider-save');
      Object.assign(existing, value);
      return existing;
    }),
    createQueryBuilder: vi.fn(() => qb),
  };
  const catalogRepo = {
    findOneBy: vi.fn(async (where: { id?: string; key?: string }) => {
      trace.push('catalog-read');
      return where.key ? null : catalog;
    }),
    create: vi.fn((value: Partial<AiProviderCatalog>) =>
      Object.assign(new AiProviderCatalog(), value),
    ),
    save: vi.fn(async (value: AiProviderCatalog) => {
      trace.push('catalog-save');
      return { ...value, id: value.id ?? '3' };
    }),
  };
  let isSuperAdmin = true;
  let hasModule = true;
  let validSession = true;
  let hasAuthorityLocks = true;
  const manager = {
    queryRunner: { isTransactionActive: true },
    query: vi.fn(async (sql: string) => {
      trace.push(sql);
      if (sql.includes('AS authority_locks'))
        return [{ authority_locks: hasAuthorityLocks ? 9 : 0 }];
      if (sql.includes('AS "actorId"'))
        return validSession
          ? [{ actorId: '1', sessionId: actor.sessionId, isSuperAdmin }]
          : [];
      if (sql.includes('AS allowed'))
        return [
          { actor_active: validSession, allowed: isSuperAdmin || hasModule },
        ];
      return [];
    }),
    getRepository: vi.fn((entity: unknown) =>
      entity === AiProvider ? providerRepo : catalogRepo,
    ),
  } as unknown as EntityManager;
  const source = {
    transaction: vi.fn(
      async (operation: (m: EntityManager) => Promise<unknown>) =>
        operation(manager),
    ),
  } as unknown as DataSource;
  const translations = {
    updateTranslations: vi.fn(async () => {
      trace.push('translations-write');
    }),
    attachTranslationsToOne: vi.fn(
      async (_: string, value: AiProvider) => value,
    ),
  } as unknown as TranslationService;
  return {
    actor,
    catalog,
    existing,
    trace,
    qb,
    providerRepo,
    catalogRepo,
    manager,
    source,
    translations,
    setAdmin(value: boolean) {
      isSuperAdmin = value;
    },
    setModule(value: boolean) {
      hasModule = value;
    },
    setSession(value: boolean) {
      validSession = value;
    },
    setAuthorityLocks(value: boolean) {
      hasAuthorityLocks = value;
    },
  };
}
