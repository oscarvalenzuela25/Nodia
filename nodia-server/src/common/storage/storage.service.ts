import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { envs } from '../../config/envs.config.js';

@Injectable()
export class StorageService {
  private readonly s3Client: S3Client | null = null;
  private readonly bucketName: string;

  constructor() {
    this.bucketName = envs.R2_BUCKET_NAME;

    if (envs.R2_ACCESS_KEY_ID && envs.R2_SECRET_ACCESS_KEY && envs.R2_ACCOUNT_ID) {
      const endpoint =
        envs.R2_ENDPOINT ||
        `https://${envs.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

      this.s3Client = new S3Client({
        region: 'auto',
        endpoint,
        credentials: {
          accessKeyId: envs.R2_ACCESS_KEY_ID,
          secretAccessKey: envs.R2_SECRET_ACCESS_KEY,
        },
      });
    }
  }

  /**
   * Uploads a file buffer to Cloudflare R2 / S3
   * @param key Storage path / key (e.g. "invoices/business-id/timestamp-file.pdf")
   * @param buffer File binary buffer
   * @param mimeType MIME type (e.g. "application/pdf", "image/png")
   * @returns The relative storage path key
   */
  async uploadFile(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    if (!this.s3Client || !this.bucketName) {
      throw new InternalServerErrorException(
        'Storage service is not configured. Missing R2 credentials.',
      );
    }

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
        }),
      );
      return key;
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Failed to upload file to storage: ${error.message}`,
      );
    }
  }
}
