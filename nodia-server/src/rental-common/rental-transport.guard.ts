import {
  BadRequestException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

/** Transport contract only. House authority is enforced inside every use case. */
@Injectable()
export class RentalTransportGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (
      !this.reflector.get<boolean>('rental:query', context.getHandler()) &&
      Object.keys(request.query).length
    )
      throw new BadRequestException('rental:invalid_input');
    return true;
  }
}
