import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ServeStaticModule } from '@nestjs/serve-static';
import { APP_GUARD } from '@nestjs/core';
import { join } from 'node:path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ThemesModule } from './themes/themes.module';
import { AvailabilityModule } from './availability/availability.module';
import { CirclesModule } from './circles/circles.module';
import { MembershipsModule } from './memberships/memberships.module';
import { MatchingModule } from './matching/matching.module';
import { MeetingsModule } from './meetings/meetings.module';
import { CallsModule } from './calls/calls.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { SeederModule } from './seeder/seeder.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
      }),
      inject: [ConfigService],
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    AuthModule,
    UsersModule,
    ThemesModule,
    CirclesModule,
    MembershipsModule,
    AvailabilityModule,
    MatchingModule,
    MeetingsModule,
    CallsModule,
    SeederModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
