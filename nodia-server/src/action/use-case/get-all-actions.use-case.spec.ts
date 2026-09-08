import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetAllActionsUseCase } from './get-all-actions.use-case.js';
import type { ActionService } from '../action.service.js';
import type { GetActionsDto } from '../dto/get-actions.dto.js';
import type { GetActionsResponse } from '../types/action.types.js';

describe('GetAllActionsUseCase', () => {
  let useCase: GetAllActionsUseCase;
  let actionServiceMock: Partial<ActionService>;

  beforeEach(() => {
    actionServiceMock = {
      findAll: vi.fn(),
    };
    useCase = new GetAllActionsUseCase(actionServiceMock as ActionService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call actionService.findAll with query params and return response', async () => {
    const dto: GetActionsDto = {
      page: 1,
      limit: 10,
      all: false,
    };

    const mockResponse: GetActionsResponse = {
      data: [
        {
          id: '1',
          key: 'users.create',
          description: 'Create user',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          action_roles: [],
          translates: [
            { key: 'key', es: 'Crear usuario', en: 'Create user' },
            { key: 'comment', es: 'Permite crear nuevos usuarios', en: 'Allows creating new users' },
          ],
        } as any,
      ],
      meta: {
        page: 1,
        limit: 10,
        total_items: 1,
        total_pages: 1,
      },
    };

    vi.mocked(actionServiceMock.findAll!).mockResolvedValue(mockResponse);

    const result = await useCase.execute(dto);

    expect(actionServiceMock.findAll).toHaveBeenCalledTimes(1);
    expect(actionServiceMock.findAll).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockResponse);
  });

  it('should call actionService.findAll with includes=false', async () => {
    const dto: GetActionsDto = {
      page: 1,
      limit: 10,
      all: true,
      includes: false,
    };

    const mockResponse: GetActionsResponse = {
      data: [
        {
          id: '1',
          key: 'users.create',
          description: 'Create user',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          action_roles: [],
          translates: [
            { key: 'key', es: 'Crear usuario', en: 'Create user' },
            { key: 'comment', es: 'Permite crear nuevos usuarios', en: 'Allows creating new users' },
          ],
        } as any,
      ],
      meta: {
        page: 1,
        limit: 1,
        total_items: 1,
        total_pages: 1,
      },
    };

    vi.mocked(actionServiceMock.findAll!).mockResolvedValue(mockResponse);

    const result = await useCase.execute(dto);

    expect(actionServiceMock.findAll).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockResponse);
  });
});
