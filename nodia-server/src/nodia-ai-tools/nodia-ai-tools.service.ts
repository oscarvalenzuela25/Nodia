import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';

@Injectable()
export class NodiaAiToolsService {
  constructor(private readonly source: DataSource) {}
  transaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.source.transaction(work);
  }
}
