import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

@Injectable()
export class SeederService implements OnModuleInit {
  private readonly logger = new Logger(SeederService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedAdminUser();
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
}
