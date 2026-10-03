import {
  Injectable,
  SetMetadata,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { CheckActionPermissionUseCase } from './use-case/check-action-permission.use-case.js';

const REQUIRED_ACTION = 'authorization:required-action';

export const RequireAction = (key: string) => SetMetadata(REQUIRED_ACTION, key);

@Injectable()
export class ActionPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly checkActionPermission: CheckActionPermissionUseCase,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const action = this.reflector.getAllAndOverride<string>(REQUIRED_ACTION, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!action) return true;
    const request = context.switchToHttp().getRequest<AuthRequest>();
    await this.checkActionPermission.execute(request.auth.user.id, action);
    return true;
  }
}
