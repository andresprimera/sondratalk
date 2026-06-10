import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { ThemesModule } from '../themes/themes.module';
import { CirclesModule } from '../circles/circles.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { SeederService } from './seeder.service';

@Module({
  imports: [UsersModule, ThemesModule, CirclesModule, MembershipsModule],
  providers: [SeederService],
})
export class SeederModule {}
