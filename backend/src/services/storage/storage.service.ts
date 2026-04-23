import { Inject, Injectable } from '@nestjs/common';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
  type UploadOptions,
  type UploadResult,
} from './storage.types';

@Injectable()
export class StorageService {
  constructor(
    @Inject(STORAGE_PROVIDER)
    private readonly provider: StorageProvider,
  ) {}

  async upload(file: Buffer, options: UploadOptions): Promise<UploadResult> {
    return this.provider.upload(file, options);
  }

  async download(key: string): Promise<Buffer> {
    return this.provider.download(key);
  }

  async delete(key: string): Promise<void> {
    return this.provider.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.provider.exists(key);
  }

  async getUrl(key: string): Promise<string> {
    return this.provider.getUrl(key);
  }
}
