import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { resolveHttpModulePolicy } from './http-module-policy.js';
import { CheckModuleAccessUseCase } from './use-case/check-module-access.use-case.js';

const paths = (value: string | string[] | undefined): string[] =>
  typeof value === 'string' ? [value] : Array.isArray(value) ? value : [];

@Injectable()
export class ModuleAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly checkModuleAccess: CheckModuleAccessUseCase,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>('auth:public', [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;

    const request = context.switchToHttp().getRequest<AuthRequest>();
    if (!request.auth?.user?.id)
      throw new UnauthorizedException('auth:unauthorized');
    const policy = resolveHttpModulePolicy(
      paths(
        this.reflector.get<string | string[]>(
          PATH_METADATA,
          context.getClass(),
        ),
      ),
      paths(
        this.reflector.get<string | string[]>(
          PATH_METADATA,
          context.getHandler(),
        ),
      ),
      request.method,
    );
    // New controller families must declare their policy before becoming usable.
    if (!policy) throw new ForbiddenException('core:module_access_required');
    // Auth and authorization/context already passed the real session guard.
    if (policy.routes.length > 0) {
      await this.checkModuleAccess.execute(
        request.auth.user.id,
        policy.routes,
        undefined,
        policy.match,
      );
    }
    return true;
  }
}
