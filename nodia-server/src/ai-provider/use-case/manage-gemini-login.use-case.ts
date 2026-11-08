import { GoneException } from '@nestjs/common';
/** Historical source marker. Web login is retired and is not registered in the module. */
export class ManageGeminiLoginUseCase {
  constructor(..._unused: unknown[]) {}
  start(..._unused: unknown[]): never { throw new GoneException('ai_provider:mode_retired'); }
  disconnect(..._unused: unknown[]): never { throw new GoneException('ai_provider:mode_retired'); }
  status(..._unused: unknown[]): never { throw new GoneException('ai_provider:mode_retired'); }
  cancel(..._unused: unknown[]): never { throw new GoneException('ai_provider:mode_retired'); }
  frame(..._unused: unknown[]): never { throw new GoneException('ai_provider:mode_retired'); }
  input(..._unused: unknown[]): never { throw new GoneException('ai_provider:mode_retired'); }
}
