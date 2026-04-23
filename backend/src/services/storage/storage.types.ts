export interface UploadOptions {
  fileName: string;
  folder?: string;
  mimeType?: string;
}

export interface UploadResult {
  key: string;
  fileName: string;
  url: string;
  size: number;
  mimeType?: string;
}

export interface StorageProvider {
  upload(file: Buffer, options: UploadOptions): Promise<UploadResult>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getUrl(key: string): string | Promise<string>;
}

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
