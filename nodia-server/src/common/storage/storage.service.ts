import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { envs } from '../../config/envs.config.js';

@Injectable()
export class StorageService implements OnModuleDestroy {
  private readonly s3Client: S3Client | null = null;
  private readonly singleAttemptS3Client: S3Client | null = null;
  private readonly bucketName: string;

  constructor() {
    this.bucketName = envs.R2_BUCKET_NAME;

    if (
      envs.R2_ACCESS_KEY_ID &&
      envs.R2_SECRET_ACCESS_KEY &&
      envs.R2_ACCOUNT_ID
    ) {
      const endpoint =
        envs.R2_ENDPOINT ||
        `https://${envs.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

      const configuration = {
        region: 'auto',
        endpoint,
        credentials: {
          accessKeyId: envs.R2_ACCESS_KEY_ID,
          secretAccessKey: envs.R2_SECRET_ACCESS_KEY,
        },
        requestChecksumCalculation: 'WHEN_REQUIRED' as const,
        responseChecksumValidation: 'WHEN_REQUIRED' as const,
      };
      this.s3Client = new S3Client(configuration);
      // A NodiaAI PUT may have persisted before its response was lost. Its
      // durable intent owns reconciliation; the SDK must not resend it.
      this.singleAttemptS3Client = new S3Client({ ...configuration, maxAttempts: 1 });
    }
  }

  onModuleDestroy() {
    this.s3Client?.destroy();
    this.singleAttemptS3Client?.destroy();
  }

  /**
   * Uploads a file buffer to Cloudflare R2 / S3
   * @param key Storage path / key (e.g. "invoices/business-id/timestamp-file.pdf")
   * @param buffer File binary buffer
   * @param mimeType MIME type (e.g. "application/pdf", "image/png")
   * @returns The relative storage path key
   */
  async uploadFile(
    key: string,
    buffer: Buffer,
    mimeType: string,
    signal?: AbortSignal,
  ): Promise<string> {
    return this.putFile(this.s3Client, key, buffer, mimeType, signal);
  }

  /** One SDK attempt only; a failed response does not prove the PUT had no effect. */
  async uploadFileOnce(
    key: string,
    buffer: Buffer,
    mimeType: string,
    signal?: AbortSignal,
  ): Promise<string> {
    return this.putFile(this.singleAttemptS3Client, key, buffer, mimeType, signal);
  }

  private async putFile(
    client: S3Client | null,
    key: string,
    buffer: Buffer,
    mimeType: string,
    signal?: AbortSignal,
  ): Promise<string> {
    if (!client || !this.bucketName) {
      throw new InternalServerErrorException(
        'Storage service is not configured. Missing R2 credentials.',
      );
    }

    try {
      signal?.throwIfAborted();
      await client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
        }),
        { abortSignal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60_000)]) : AbortSignal.timeout(60_000) },
      );
      return key;
    } catch {
      throw new InternalServerErrorException(
        'Failed to upload file to storage.',
      );
    }
  }

  /** Idempotent compensation; a failed PUT may already have stored the object. */
  async deleteFile(key: string): Promise<void> {
    if (!this.s3Client || !this.bucketName) {
      throw new InternalServerErrorException(
        'Storage service is not configured.',
      );
    }
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({ Bucket: this.bucketName, Key: key }),
        { abortSignal: AbortSignal.timeout(10_000) },
      );
    } catch {
      throw new InternalServerErrorException(
        'Failed to delete file from storage.',
      );
    }
  }

  /**
   * Generates a temporary signed URL for viewing/downloading a file from Cloudflare R2 / S3
   * @param key Storage path / key
   * @param expiresInSeconds Duration in seconds for URL validity (default: 1800s = 30min)
   * @returns Temporary presigned URL
   */
  async getSignedFileUrl(
    key: string,
    expiresInSeconds = 1800,
  ): Promise<string> {
    if (!this.s3Client || !this.bucketName) {
      throw new InternalServerErrorException(
        'Storage service is not configured. Missing R2 credentials.',
      );
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      return await getSignedUrl(this.s3Client, command, {
        expiresIn: expiresInSeconds,
      });
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Failed to generate signed URL for file: ${error.message}`,
      );
    }
  }

  /** Private bounded download. Never puts a signed bearer URL in a chat or redirect. */
  async downloadFile(key: string, maxBytes: number, signal: AbortSignal): Promise<Buffer> {
    signal.throwIfAborted();
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1)
      throw new BadRequestException('Storage download limit is invalid');
    if (!this.s3Client || !this.bucketName)
      throw new InternalServerErrorException('Storage service is not configured.');
    const result = await this.s3Client.send(
      new GetObjectCommand({ Bucket: this.bucketName, Key: key }),
      { abortSignal: signal },
    );
    const body = result.Body;
    if (!body) throw new InternalServerErrorException('Storage returned an empty body.');
    const destroy = () => {
      if ('destroy' in body && typeof body.destroy === 'function') body.destroy();
    };
    signal.addEventListener('abort', destroy, { once: true });
    try {
      if (result.ContentLength !== undefined && result.ContentLength > maxBytes)
        throw new BadRequestException('File exceeds download byte limit');
      if (!(Symbol.asyncIterator in body))
        throw new InternalServerErrorException('Storage streaming is not supported.');
      const chunks: Buffer[] = [];
      let bytes = 0;
      for await (const chunk of body) {
        signal.throwIfAborted();
        const data = Buffer.from(chunk);
        bytes += data.byteLength;
        if (bytes > maxBytes) throw new BadRequestException('File exceeds download byte limit');
        chunks.push(data);
      }
      signal.throwIfAborted();
      return Buffer.concat(chunks, bytes);
    } finally {
      signal.removeEventListener('abort', destroy);
      destroy();
    }
  }
}
