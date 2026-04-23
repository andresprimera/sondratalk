import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import { LocalStorageProvider } from './local-storage.provider';
import { GcsStorageProvider } from './gcs-storage.provider';
import { FirebaseStorageProvider } from './firebase-storage.provider';
import { STORAGE_PROVIDER, type StorageProvider } from './storage.types';

@Module({
  providers: [
    {
      provide: STORAGE_PROVIDER,
      useFactory: (configService: ConfigService): StorageProvider => {
        const provider = configService.get<string>(
          'STORAGE_PROVIDER',
          'local',
        );

        switch (provider) {
          case 'local':
            return new LocalStorageProvider(configService);
          case 'gcs':
            return new GcsStorageProvider(configService);
          case 'firebase':
            return new FirebaseStorageProvider(configService);
          default:
            throw new Error(`Unknown storage provider: ${provider}`);
        }
      },
      inject: [ConfigService],
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
