import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';
import { PresignUploadDto, PresignUploadResponseDto } from '@diagramz/shared';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client | null = null;
  private bucketName: string;
  private publicUrl: string;

  constructor(private configService: ConfigService) {
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY');
    this.bucketName = this.configService.get<string>('R2_BUCKET_NAME') || 'diagramz-assets';
    this.publicUrl = this.configService.get<string>('R2_PUBLIC_URL') || 'https://assets.diagramz.io';

    if (accountId && accessKeyId && secretAccessKey) {
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.logger.log('Cloudflare R2 storage client configured');
    } else {
      this.logger.warn('Cloudflare R2 credentials not provided; mock storage fallback enabled');
    }
  }

  async generatePresignedUploadUrl(dto: PresignUploadDto): Promise<PresignUploadResponseDto> {
    const randomHex = crypto.randomBytes(8).toString('hex');
    const cleanFilename = dto.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `${dto.folder}/${Date.now()}-${randomHex}-${cleanFilename}`;

    if (!this.s3Client) {
      return {
        uploadUrl: `http://localhost:4000/api/v1/storage/mock-upload?key=${encodeURIComponent(key)}`,
        key,
        publicUrl: `${this.publicUrl}/${key}`,
      };
    }

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: dto.contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });

    return {
      uploadUrl,
      key,
      publicUrl: `${this.publicUrl}/${key}`,
    };
  }

  async getDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    if (!this.s3Client) {
      return `${this.publicUrl}/${key}`;
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async uploadBuffer(key: string, buffer: Buffer, contentType: string): Promise<string> {
    if (this.s3Client) {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );
    }
    return `${this.publicUrl}/${key}`;
  }
}
