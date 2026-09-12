import { Public } from './auth/auth.guard.js';
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getHelloWorld(): string {
    return this.appService.getHelloWorld();
  }
}
