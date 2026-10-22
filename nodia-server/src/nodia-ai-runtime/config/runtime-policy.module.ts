import { readFileSync } from 'node:fs';
import { Module } from '@nestjs/common';
import { ValidateNodiaAiRuntimePolicyUseCase } from '../use-case/validate-nodia-ai-runtime-policy.use-case.js';
import { NODIA_AI_RUNTIME_POLICY } from './runtime-policy.js';

@Module({
  providers: [
    ValidateNodiaAiRuntimePolicyUseCase,
    {
      provide: NODIA_AI_RUNTIME_POLICY,
      inject: [ValidateNodiaAiRuntimePolicyUseCase],
      useFactory: (validate: ValidateNodiaAiRuntimePolicyUseCase) => {
        try {
          return validate.execute(
            JSON.parse(
              readFileSync(
                new URL('./runtime-policy.json', import.meta.url),
                'utf8',
              ),
            ),
          );
        } catch {
          throw new Error('nodia_ai_runtime_policy_unavailable');
        }
      },
    },
  ],
  exports: [NODIA_AI_RUNTIME_POLICY, ValidateNodiaAiRuntimePolicyUseCase],
})
export class NodiaAiRuntimePolicyModule {}
