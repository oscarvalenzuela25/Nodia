// Real Nest/Multer/Busboy boundary only. Domain persistence and R2 are never invoked.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, it } from 'node:test';
import {
  Controller,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductImageController } from '../dist/product-image/product-image.controller.js';
import { ManageProductImageUseCase } from '../dist/product-image/use-case/manage-product-image.use-case.js';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC', 'base64');
const businessId = '11111111-1111-4111-8111-111111111111';
const imageId = '22222222-2222-4222-8222-222222222222';
const actor = { userId: '1', sessionId: '33333333-3333-4333-8333-333333333333' };
let app, url;
const uploads = [];
const file = () => new Blob([PNG], { type: 'image/png' });
const form = () => {
  const value = new FormData(); value.append('file', file(), 'tiny.png'); return value;
};
const put = (base, path, body) => fetch(base + path, { method: 'PUT', body, redirect: 'error', signal: AbortSignal.timeout(10000) });

before(async () => {
  const module = await Test.createTestingModule({
    controllers: [ProductImageController],
    providers: [{ provide: ManageProductImageUseCase, useValue: {
      upload: async (actualActor, actualBusiness, actualImage, uploaded) => {
        assert.deepEqual(actualActor, actor);
        assert.equal(actualBusiness, businessId); assert.equal(actualImage, imageId);
        assert(Buffer.isBuffer(uploaded.buffer)); assert.deepEqual(uploaded.buffer, PNG);
        uploads.push({ bytes: uploaded.buffer.length, mime_type: uploaded.mimetype, field: uploaded.fieldname });
        return { received_bytes: uploaded.buffer.length, mime_type: uploaded.mimetype };
      },
    } }],
  }).compile();
  app = module.createNestApplication({ logger: false });
  app.use((request, _response, next) => {
    request.auth = { user: { id: actor.userId }, sessionId: actor.sessionId }; next();
  });
  await app.listen(0, '127.0.0.1'); url = await app.getUrl();
});
after(async () => { await app?.close(); });

it('reproduces the real Busboy threshold rejection for one FormData file at parts=1', async () => {
  class ThresholdProbe {
    upload() { throw Error('the parser must reject before the handler'); }
  }
  Controller('probe')(ThresholdProbe);
  const descriptor = Object.getOwnPropertyDescriptor(ThresholdProbe.prototype, 'upload');
  Put('content')(ThresholdProbe.prototype, 'upload', descriptor);
  UploadedFile()(ThresholdProbe.prototype, 'upload', 0);
  UseInterceptors(FileInterceptor('file', { limits: { files: 1, fields: 0, parts: 1, fileSize: 8 * 1024 * 1024 } }))(ThresholdProbe.prototype, 'upload', descriptor);
  const module = await Test.createTestingModule({ controllers: [ThresholdProbe] }).compile();
  const legacy = module.createNestApplication({ logger: false });
  try {
    await legacy.listen(0, '127.0.0.1');
    const response = await put(await legacy.getUrl(), '/probe/content', form());
    assert.equal(response.status, 400); assert.equal((await response.json()).message, 'Too many parts');
  } finally { await legacy.close(); }
});

it('accepts one real PNG FormData file through the production interceptor', async () => {
  const before = uploads.length;
  const response = await put(url, `/businesses/${businessId}/product-image-uploads/${imageId}/content`, form());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { received_bytes: PNG.length, mime_type: 'image/png' });
  assert.equal(uploads.length, before + 1); assert.equal(uploads.at(-1).field, 'file');
});

it('still rejects text fields before and after the image before reaching domain code', async () => {
  const before = uploads.length;
  for (const textFirst of [true, false]) {
    const body = new FormData();
    if (textFirst) body.append('metadata', 'synthetic');
    body.append('file', file(), 'tiny.png');
    if (!textFirst) body.append('metadata', 'synthetic');
    const response = await put(url, `/businesses/${businessId}/product-image-uploads/${imageId}/content`, body);
    assert.equal(response.status, 400); await response.body?.cancel();
  }
  assert.equal(uploads.length, before);
});

it('still rejects a second file and an unexpected file field before domain code', async () => {
  const before = uploads.length;
  const double = form(); double.append('file', file(), 'second.png');
  const unexpected = new FormData(); unexpected.append('other_file', file(), 'tiny.png');
  for (const body of [double, unexpected]) {
    const response = await put(url, `/businesses/${businessId}/product-image-uploads/${imageId}/content`, body);
    assert.equal(response.status, 400); await response.body?.cancel();
  }
  assert.equal(uploads.length, before);
});
