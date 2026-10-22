import { Injectable } from '@nestjs/common';
import { readFile, stat } from 'node:fs/promises';
import { StorageService } from '../../common/storage/storage.service.js';
import { NodiaAiAttachmentStorage } from '../types/attachment-ports.js';

@Injectable()
export class StorageNodiaAiAttachment extends NodiaAiAttachmentStorage {
  constructor(private readonly storage: StorageService) {
    super();
  }
  async put(key: string, path: string, mediaType: string, signal: AbortSignal) {
    signal.throwIfAborted();
    const info = await stat(path);
    if (!info.isFile() || info.size > 20971520)
      throw new Error('nodia_ai:invalid_input');
    const buffer = await readFile(path, { signal });
    await this.storage.uploadFileOnce(key, buffer, mediaType, signal);
  }
  get(key: string, maxBytes: number, signal: AbortSignal) {
    return this.storage.downloadFile(key, maxBytes, signal);
  }
  delete(key: string) {
    return this.storage.deleteFile(key);
  }
}
