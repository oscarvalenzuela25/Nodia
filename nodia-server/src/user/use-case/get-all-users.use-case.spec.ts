import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { DataSource, EntitySchema, type SelectQueryBuilder, type Repository, type ObjectLiteral } from 'typeorm';
import { RentalValidationPipe } from '../../rental-common/rental-validation.pipe.js';
import { TranslationService } from '../../translation/translation.service.js';
import { RedisService } from '../../common/redis/redis.service.js';
import type { User } from '../entities/user.entity.js';
import { GetAllUsersUseCase } from './get-all-users.use-case.js';
import { UserService } from '../user.service.js';
import { GetUsersDto } from '../dto/get-users.dto.js';
import type { GetUsersResponse } from '../types/user.types.js';

describe('GetAllUsersUseCase', () => {
  let useCase: GetAllUsersUseCase;
  let userServiceMock: Partial<UserService>;

  beforeEach(() => {
    userServiceMock = {
      findAll: vi.fn(),
    };
    useCase = new GetAllUsersUseCase(userServiceMock as UserService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call userService.findAll with the provided query params and return the response', async () => {
    const dto: GetUsersDto = {
      page: 1,
      limit: 10,
      all: false,
    };

    const mockResponse: GetUsersResponse = {
      data: [
        {
          id: '1',
          name: 'Jane Doe',
          email: 'jane@example.com',
          image_url: null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          user_roles: [],
          user_modules: [],
        },
      ],
      meta: {
        page: 1,
        limit: 10,
        total_items: 1,
        total_pages: 1,
      },
    };

    vi.mocked(userServiceMock.findAll!).mockResolvedValue(mockResponse);

    const result = await useCase.execute(dto);

    expect(userServiceMock.findAll).toHaveBeenCalledTimes(1);
    expect(userServiceMock.findAll).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockResponse);
  });

  it('should call userService.findAll with includes=false to omit relations', async () => {
    const dto: GetUsersDto = {
      page: 1,
      limit: 10,
      all: true,
      includes: false,
    };

    const mockResponse: GetUsersResponse = {
      data: [
        {
          id: '1',
          name: 'Jane Doe',
          email: 'jane@example.com',
          image_url: null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          user_roles: [],
          roles: [],
          user_modules: [],
        },
      ],
      meta: {
        page: 1,
        limit: 1,
        total_items: 1,
        total_pages: 1,
      },
    };

    vi.mocked(userServiceMock.findAll!).mockResolvedValue(mockResponse);

    const result = await useCase.execute(dto);

    expect(userServiceMock.findAll).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockResponse);
  });

  it('should return users with modules containing translates when included', async () => {
    const dto: GetUsersDto = {
      page: 1,
      limit: 10,
      all: false,
      includes: true,
    };

    const mockResponse: GetUsersResponse = {
      data: [
        {
          id: '1',
          name: 'Jane Doe',
          email: 'jane@example.com',
          image_url: null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          user_roles: [],
          roles: [],
          user_modules: [],
          modules: [
            {
              id: '10',
              key: 'settings',
              group_by: 'core',
              is_active: true,
              created_at: new Date(),
              updated_at: new Date(),
              module_users: [],
              translates: [{ key: 'key', es: 'Configuración', en: 'Settings' }],
            } as any,
          ],
        },
      ],
      meta: {
        page: 1,
        limit: 10,
        total_items: 1,
        total_pages: 1,
      },
    };

    vi.mocked(userServiceMock.findAll!).mockResolvedValue(mockResponse);

    const result = await useCase.execute(dto);

    expect(userServiceMock.findAll).toHaveBeenCalledWith(dto);
    expect(result.data[0].modules?.[0].translates).toEqual([
      { key: 'key', es: 'Configuración', en: 'Settings' },
    ]);
  });
});


class OfflineScopeUserDataSource extends DataSource {
  async prepare() {
    await this.buildMetadatas();
  }
}

describe('GetAllUsersUseCase: owner selector HTTP filters', () => {
  let source: OfflineScopeUserDataSource;
  let useCase: GetAllUsersUseCase;
  let query: SelectQueryBuilder<User>;
  let executeQuery: ReturnType<typeof vi.fn>;
  const pipe = new RentalValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  beforeAll(async () => {
    source = new OfflineScopeUserDataSource({
      type: 'postgres',
      entities: [new EntitySchema<User>({
        name: 'ScopeUser',
        tableName: 'users',
        columns: {
          id: { type: 'bigint', primary: true },
          name: { type: 'varchar', nullable: true },
          email: { type: 'text' },
          is_active: { type: 'boolean' },
          created_at: { type: 'timestamp' },
          updated_at: { type: 'timestamp' },
        },
      })],
    });
    // Metadata and SQL construction only: no socket or database is initialized.
    await source.prepare();
  });
  beforeEach(() => {
    const repo = source.getRepository<User>('ScopeUser');
    const create = repo.createQueryBuilder.bind(repo);
    executeQuery = vi.fn().mockResolvedValue([[], 0]);
    vi.spyOn(repo, 'createQueryBuilder').mockImplementation((alias) => {
      query = create(alias);
      vi.spyOn(query, 'getManyAndCount').mockImplementation(executeQuery);
      return query;
    });
    const unusedRepository = <T extends ObjectLiteral>(): Repository<T> =>
      ({} as Repository<T>);
    useCase = new GetAllUsersUseCase(new UserService(
      repo,
      unusedRepository(),
      unusedRepository(),
      new TranslationService(unusedRepository()),
      new RedisService(),
    ));
  });
  afterEach(() => vi.restoreAllMocks());
  const transform = async (q: object): Promise<GetUsersDto> =>
    await pipe.transform({ page: '1', limit: '20', includes: 'false', q },
      { type: 'query', metatype: GetUsersDto }) as GetUsersDto;

  it('accepts the selected owner ID through the strict HTTP pipe and parameterizes it without numeric coercion', async () => {
    const selectedId = '9007199254740993';
    const dto = await transform({ id_eq: selectedId });
    expect(dto.q?.id_eq).toBe(selectedId);
    await expect(useCase.execute(dto)).resolves.toMatchObject({
      data: [], meta: { page: 1, limit: 20, total_items: 0 },
    });
    expect(query.getQuery()).toContain('"user"."id" = :ransack_0');
    expect(query.getParameters()).toEqual({ ransack_0: selectedId });
    expect(query.getQuery()).not.toContain('JOIN');
    expect(executeQuery).toHaveBeenCalledOnce();
  });
  it('keeps the ordinary unfiltered owner list available', async () => {
    await useCase.execute(await transform({}));
    expect(query.getQuery()).not.toContain(' WHERE ');
    expect(query.getParameters()).toEqual({});
    expect(executeQuery).toHaveBeenCalledOnce();
  });
  it('rejects unknown HTTP filters instead of relaxing the allowlist', async () => {
    await expect(transform({ private_field_eq: '1' })).rejects.toBeInstanceOf(BadRequestException);
    expect(executeQuery).not.toHaveBeenCalled();
  });
  it.each([{ value: ['1', '2'] }, { value: { injected: '1' } }, { value: 1 }])('rejects a non-string selected ID before querying (%j)', async ({ value }) => {
    await expect(transform({ id_eq: value })).rejects.toBeInstanceOf(BadRequestException);
    expect(executeQuery).not.toHaveBeenCalled();
  });
  it.each(['1 OR 1=1', '9223372036854775808'])('rejects malformed or out-of-range IDs with the real Ransack policy (%s)', async (value) => {
    const dto = await transform({ id_eq: value });
    await expect(useCase.execute(dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(executeQuery).not.toHaveBeenCalled();
  });
});
