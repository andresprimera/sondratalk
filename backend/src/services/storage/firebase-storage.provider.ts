import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import type { Bucket } from '@google-cloud/storage';
import { randomUUID } from 'node:crypto';
import type {
  StorageProvider,
  UploadOptions,
  UploadResult,
} from './storage.types';

export class FirebaseStorageProvider implements StorageProvider {
  private readonly bucket: Bucket;
  private readonly signedUrlExpires: number;
  private readonly logger = new Logger(FirebaseStorageProvider.name);

  constructor(private configService: ConfigService) {
    const bucketName =
      this.configService.getOrThrow<string>('FIREBASE_BUCKET');
    const keyFile =
      this.configService.getOrThrow<string>('FIREBASE_KEY_FILE');
    this.signedUrlExpires = Number(
      this.configService.get<string>('FIREBASE_SIGNED_URL_EXPIRES', '3600'),
    );

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(keyFile),
        storageBucket: bucketName,
      });
    }

    this.bucket = admin.storage().bucket(bucketName);
  }

  async upload(file: Buffer, options: UploadOptions): Promise<UploadResult> {
    const folder = options.folder ?? '';
    const uniqueName = `${randomUUID()}-${options.fileName}`;
    const key = folder ? `${folder}/${uniqueName}` : uniqueName;

    const firebaseFile = this.bucket.file(key);
    await firebaseFile.save(file, {
      contentType: options.mimeType,
      resumable: false,
    });

    const url = await this.getUrl(key);
    this.logger.log(`File uploaded to Firebase: ${key}`);

    return {
      key,
      fileName: options.fileName,
      url,
      size: file.length,
      mimeType: options.mimeType,
    };
  }

  async download(key: string): Promise<Buffer> {
    const [contents] = await this.bucket.file(key).download();
    return contents;
  }

  async delete(key: string): Promise<void> {
    await this.bucket.file(key).delete();
    this.logger.log(`File deleted from Firebase: ${key}`);
  }

  async exists(key: string): Promise<boolean> {
    const [result] = await this.bucket.file(key).exists();
    return result;
  }

  async getUrl(key: string): Promise<string> {
    const [url] = await this.bucket.file(key).getSignedUrl({
      action: 'read',
      expires: Date.now() + this.signedUrlExpires * 1000,
    });
    return url;
  }
}
