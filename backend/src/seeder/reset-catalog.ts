import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { SeederService } from './seeder.service';

// Standalone entrypoint: `pnpm seed:reset`. Boots the app context (no HTTP
// listener), converges the themes + circles collections to the seed data,
// and prunes orphaned memberships. Connects to whatever MONGO_URI resolves
// to — double-check your .env before running against a shared cluster.
async function bootstrap(): Promise<void> {
  const logger = new Logger('ResetCatalog');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    await app.get(SeederService).resetCatalog();
  } catch (err) {
    logger.error(
      'Catalog reset failed',
      err instanceof Error ? err.stack : String(err),
    );
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void bootstrap();
