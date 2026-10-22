// Disposable compiled process fixture. No configured database, provider or .env.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

process.env.DOTENV_CONFIG_PATH = process.platform === 'win32' ? 'NUL' : '/dev/null';
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_STORAGE = 'memory';
const options = JSON.parse(process.env.NODIA_AI28_FIXTURE_DB);
assert.equal(options.host, '127.0.0.1');
assert.equal(options.database, 'ai28');
assert.notEqual(options.port, 5432);
options.extra = { application_name: 'nodia_ai28_fault_worker' };
const load = async (file, name) => (await import('../dist/' + file + '.js'))[name];
const Execution = await load('nodia-ai-execution/nodia-ai-execution.module', 'NodiaAiExecutionModule');
const Claim = await load('nodia-ai-execution/use-case/claim-nodia-ai-execution.use-case', 'ClaimNodiaAiExecutionUseCase');
const Execute = await load('nodia-ai-execution/use-case/execute-nodia-ai-local-execution.use-case', 'ExecuteNodiaAiLocalExecutionUseCase');
const Redis = await load('common/redis/redis.service', 'RedisService');
const db = await new DataSource(options).initialize();
const compiled = await Test.createTestingModule({ imports: [
  TypeOrmModule.forRootAsync({ useFactory: () => options, dataSourceFactory: async () => db }), Execution,
] })
.overrideProvider(Redis).useValue({ get: async () => null, set: async () => {}, del: async () => {}, keys: async () => [], delByPattern: async () => {} }).compile();
let claim;
process.on('message', async message => {
  try {
    if (message.type === 'claim') {
      claim = await compiled.get(Claim).execute(message.workerId);
      process.send({ type: 'claimed', claim });
    } else if (message.type === 'execute') {
      const result = await compiled.get(Execute).execute(claim.identity, claim.executionId, claim);
      process.send({ type: 'completed', execution: result });
    } else if (message.type === 'close') {
      await compiled.close();
      process.disconnect();
    }
  } catch (error) {
    process.send({ type: 'error', status: error.getStatus?.() ?? null, message: error.message });
  }
});
process.send({ type: 'ready' });
