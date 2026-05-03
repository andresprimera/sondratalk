import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { ThemesService } from '../themes/themes.service';
import { CirclesService } from '../circles/circles.service';
import { SEED_THEMES } from './data/themes';
import { SEED_CIRCLES } from './data/circles';

@Injectable()
export class SeederService implements OnModuleInit {
  private readonly logger = new Logger(SeederService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly themesService: ThemesService,
    private readonly circlesService: CirclesService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedAdminUser();
    await this.seedThemes();
    await this.seedCircles();
  }

  private async seedAdminUser(): Promise<void> {
    const name = this.configService.get<string>('SEED_ADMIN_NAME');
    const email = this.configService.get<string>('SEED_ADMIN_EMAIL');
    const password = this.configService.get<string>('SEED_ADMIN_PASSWORD');

    if (!name || !email || !password) {
      return;
    }

    const exists = await this.usersService.findByEmailExists(email);

    if (exists) {
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await this.usersService.create({
      name,
      email,
      password: hashedPassword,
      role: 'admin',
    });

    this.logger.log(`Seeded default admin user: ${email}`);
  }

  private async seedThemes(): Promise<void> {
    for (const seed of SEED_THEMES) {
      const { id, ...data } = seed;
      await this.themesService.upsertById(id, data);
    }
    this.logger.log(`Seeded ${SEED_THEMES.length} themes`);
  }

  private async seedCircles(): Promise<void> {
    for (const seed of SEED_CIRCLES) {
      const { id, ...data } = seed;
      await this.circlesService.upsertById(id, data);
    }
    this.logger.log(`Seeded ${SEED_CIRCLES.length} circles`);
  }
}
