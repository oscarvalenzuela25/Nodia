import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { resolveWebPushDeliveryResult } from './web-push-delivery-policy.js';
import { WebPushDeliveryStore } from './web-push-delivery.store.js';
import { WebPushTransport, type WebPushOutcome } from './web-push-transport.js';

const maxClaimsPerCycle = 12;
const jitterCeilingMs = 3_000;

@Injectable()
export class DeliverProviderVisitsUseCase {
  constructor(
    private readonly store: WebPushDeliveryStore,
    private readonly transport: WebPushTransport,
  ) {}

  async execute(
    asOf?: Date,
    shouldStop: () => boolean = () => false,
  ): Promise<number> {
    if (shouldStop()) return 0;

    const clock = () => asOf ?? new Date();
    const keyId = this.transport.configuredKeyId();
    await this.store.prepare({ now: clock(), keyId });
    if (!keyId) return 0;

    let processed = 0;
    for (let count = 0; count < maxClaimsPerCycle && !shouldStop(); count++) {
      const claim = await this.store.claim(clock());
      if (!claim || shouldStop()) break;
      const armed = await this.store.arm(claim, keyId, clock());
      if (!armed) continue;

      let outcome: WebPushOutcome;
      try {
        outcome = await this.transport.send(armed);
      } catch {
        // The dispatch was armed. An unexpected adapter error cannot prove no write.
        outcome = { kind: 'unknown', reason: 'transport' };
      }

      const observedAt = clock();
      const result = resolveWebPushDeliveryResult(
        outcome,
        armed,
        observedAt,
        randomInt(jitterCeilingMs + 1),
      );
      await this.store.finish(claim, result, observedAt);
      processed++;
    }
    return processed;
  }
}
