import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  Body,
  Controller,
  Module,
  Post,
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { LoginDto } from '../auth/dto/login.dto.js';
import { teacherBodyParser } from './teacher-body-parser.js';

// The real Nest Express adapter installs its default parser during app.init().
// No AuthService, Google request, provider runtime or auth session is involved.
class ParserProbeController {
  login(body: LoginDto) {
    return { provider: body.provider, credential_length: body.credential.length };
  }
  teacher(body: { text: string }) {
    return { text_bytes: Buffer.byteLength(body.text, 'utf8') };
  }
}
Controller()(ParserProbeController);
for (const [method, path] of [
  ['login', 'auth/login'],
  ['teacher', 'teacher/probe'],
] as const) {
  const descriptor = Object.getOwnPropertyDescriptor(
    ParserProbeController.prototype,
    method,
  )!;
  Post(path)(ParserProbeController.prototype, method, descriptor);
  Body()(ParserProbeController.prototype, method, 0);
}
Reflect.defineMetadata(
  'design:paramtypes',
  [LoginDto],
  ParserProbeController.prototype,
  'login',
);
class ParserProbeModule {}
Module({ controllers: [ParserProbeController] })(ParserProbeModule);

describe('Teacher scoped parser with the real Nest Express parser registration', () => {
  let app: INestApplication;
  let base: string;
  beforeAll(async () => {
    app = await NestFactory.create(ParserProbeModule, { logger: false });
    app.setGlobalPrefix('api/v1');
    app.use('/api/v1/teacher', teacherBodyParser);
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });
  afterAll(async () => {
    await app?.close();
  });

  it('parses and validates the actual login DTO outside the Teacher mount', async () => {
    const response = await fetch(base + '/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'google', credential: 'x'.repeat(1198) }),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      provider: 'google',
      credential_length: 1198,
    });
  });

  it('retains the256KiB Teacher allowance beyond Nest default100KiB', async () => {
    const response = await fetch(base + '/api/v1/teacher/probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'x'.repeat(150 * 1024) }),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ text_bytes: 150 * 1024 });
  });

  it('rejects Teacher bodies beyond256KiB before the handler', async () => {
    const response = await fetch(base + '/api/v1/teacher/probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'x'.repeat(256 * 1024) }),
    });
    expect(response.status).toBe(413);
  });

  it('retains strict Teacher JSON and fatal UTF8 validation', async () => {
    for (const body of [Buffer.from('"scalar"'), Buffer.from([123, 34, 120, 34, 58, 34, 0xff, 34, 125])]) {
      const response = await fetch(base + '/api/v1/teacher/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      expect(response.status).toBe(400);
    }
  });
});
