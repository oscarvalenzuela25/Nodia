import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetAuthorizationContextUseCase } from './get-authorization-context.use-case.js';
import type { AuthorizationService } from '../authorization.service.js';
import type { AuthorizationContextResponse } from '../types/authorization.types.js';

describe('GetAuthorizationContextUseCase', () => {
  let useCase: GetAuthorizationContextUseCase;
  let authorizationServiceMock: Partial<AuthorizationService>;

  beforeEach(() => {
    authorizationServiceMock = {
      getContext: vi.fn(),
    };
    useCase = new GetAuthorizationContextUseCase(
      authorizationServiceMock as AuthorizationService,
    );
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call authorizationService.getContext with the provided email and return context', async () => {
    const email = 'oavr.18@gmail.com';
    const mockResponse: AuthorizationContextResponse = {
      roles: ['admin', 'manager'],
      actions: [
        {
          key: 'users.create',
          translates: [
            { key: 'key', es: 'Crear Usuario', en: 'Create User' },
          ],
        },
      ],
      modules: [
        {
          module_group_key: 'general_settings',
          translates: [
            { key: 'key', es: 'Ajustes Generales', en: 'General Settings' },
          ],
          modules: [
            {
              key: 'users',
              link: '/general-settings/users',
              translates: [
                { key: 'key', es: 'Usuarios', en: 'Users' },
              ],
            },
          ],
        },
      ],
      can_analyze_invoice: true,
      can_use_gemini: true,
      can_use_mistral: true,
    };

    vi.mocked(authorizationServiceMock.getContext!).mockResolvedValue(
      mockResponse,
    );

    const result = await useCase.execute(email);

    expect(authorizationServiceMock.getContext).toHaveBeenCalledTimes(1);
    expect(authorizationServiceMock.getContext).toHaveBeenCalledWith(email);
    expect(result).toEqual(mockResponse);
  });

  it('rejects missing identity instead of falling back to a developer account', async () => {
    await expect(useCase.execute()).rejects.toThrow('auth:session_expired');
    expect(authorizationServiceMock.getContext).not.toHaveBeenCalled();
  });
});
