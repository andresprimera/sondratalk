import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  StorageProvider,
  UploadOptions,
  UploadResult,
} from './storage.types';

export class LocalStorageProvider implements StorageProvider {
  private readonly rootPath: string;
  private readonly logger = new Logger(LocalStorageProvider.name);

  constructor(private configService: ConfigService) {
    this.rootPath = this.configService.get<string>(
      'STORAGE_LOCAL_PATH',
      './uploads',
    );
  }

  async upload(file: Buffer, options: UploadOptions): Promise<UploadResult> {
    const folder = options.folder ?? '';
    const uniqueName = `${randomUUID()}-${options.fileName}`;
    const key = folder ? `${folder}/${uniqueName}` : uniqueName;
    const filePath = path.join(this.rootPath, key);

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, file);

    this.logger.log(`File uploaded: ${key}`);

    return {
      key,
      fileName: options.fileName,
      url: this.getUrl(key),
      size: file.length,
      mimeType: options.mimeType,
    };
  }

  async download(key: string): Promise<Buffer> {
    const filePath = path.join(this.rootPath, key);
    return fs.readFile(filePath);
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.rootPath, key);
    await fs.unlink(filePath);
    this.logger.log(`File deleted: ${key}`);
  }

  async exists(key: string): Promise<boolean> {
    const filePath = path.join(this.rootPath, key);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  getUrl(key: string): string {
    return `/uploads/${key}`;
  }
}
