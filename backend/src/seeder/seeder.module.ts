import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { ThemesModule } from '../themes/themes.module';
import { CirclesModule } from '../circles/circles.module';
import { SeederService } from './seeder.service';

@Module({
  imports: [UsersModule, ThemesModule, CirclesModule],
  providers: [SeederService],
})
export class SeederModule {}
