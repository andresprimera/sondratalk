import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { CorsIoAdapter } from './realtime/cors-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  const corsOrigin = process.env.CORS_ORIGIN;
  const origin: string[] | boolean = corsOrigin
    ? corsOrigin.split(',').map((o) => o.trim())
    : true;
  app.enableCors({ origin });
  // socket.io runs on the same server; give the WS layer the same CORS policy.
  app.useWebSocketAdapter(new CorsIoAdapter(app, origin));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(process.env.PORT ?? 3030);
}
bootstrap();
