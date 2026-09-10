import { Injectable } from '@nestjs/common';
import { AuthorizationService } from '../authorization.service.js';
import { AuthorizationContextResponse } from '../types/authorization.types.js';

@Injectable()
export class GetAuthorizationContextUseCase {
  constructor(private readonly authorizationService: AuthorizationService) {}

  async execute(email?: string): Promise<AuthorizationContextResponse> {
    return this.authorizationService.getContext(email);
  }
}
