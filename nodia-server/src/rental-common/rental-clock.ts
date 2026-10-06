import { Injectable } from '@nestjs/common';

@Injectable()
export class RentalClock {
  now(): Date {
    return new Date();
  }
}
