import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ManageProductImageUseCase } from './use-case/manage-product-image.use-case.js';

@Injectable()
export class ProductImageRecoveryWorker
  implements OnModuleInit, OnModuleDestroy
{
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  private readonly logger = new Logger(ProductImageRecoveryWorker.name);
  constructor(private readonly images: ManageProductImageUseCase) {}
  onModuleInit() {
    this.timer = setInterval(() => {
      this.tick();
    }, 60_000);
    this.timer.unref();
    this.tick();
  }
  private tick() {
    if (this.running) return;
    this.running = this.images
      .cleanup()
      .then(() => undefined)
      .catch(() => {
        this.logger.warn({ event: 'product_image_cleanup_deferred' });
      })
      .finally(() => {
        this.running = undefined;
      });
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
}
