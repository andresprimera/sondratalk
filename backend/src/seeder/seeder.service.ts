import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { ThemesService } from '../themes/themes.service';
import { CirclesService } from '../circles/circles.service';
import { MembershipsService } from '../memberships/memberships.service';
import { SEED_THEMES } from './data/themes';
import { SEED_CIRCLES } from './data/circles';

@Injectable()
export class SeederService implements OnModuleInit {
  private readonly logger = new Logger(SeederService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly themesService: ThemesService,
    private readonly circlesService: CirclesService,
    private readonly membershipsService: MembershipsService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.configService.get<string>('SEED_ON_BOOT') !== 'true') {
      return;
    }

    await this.seedAdminUser();
    await this.seedThemes();
    await this.seedCircles();
  }

  // Destructive: converges the themes + circles collections to exactly the
  // seed data, then deletes memberships orphaned by removed circles. Invoked
  // on demand by the `seed:reset` script — never on boot.
  async resetCatalog(): Promise<void> {
    this.logger.log('Resetting catalog to seed data…');
    await this.themesService.removeAll();
    await this.seedThemes();
    await this.circlesService.removeAll();
    await this.seedCircles();
    const orphans = await this.membershipsService.removeOrphaned();
    this.logger.log(`Removed ${orphans} orphaned membership(s)`);
    this.logger.log('Catalog reset complete');
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
    // Build an in-memory map of theme id → labels so we can denormalize
    // themeLabels onto each seeded circle. Source of truth is SEED_THEMES,
    // which seedThemes() upserted just before this call.
    const themeLabelsById = new Map(
      SEED_THEMES.map((t) => [t.id, { en: t.labels.en, es: t.labels.es }]),
    );

    for (const seed of SEED_CIRCLES) {
      const { id, ...data } = seed;
      const themeLabels = themeLabelsById.get(data.themeId);
      if (!themeLabels) {
        this.logger.warn(
          `Skipping circle ${seed.slug}: theme ${data.themeId} not in SEED_THEMES`,
        );
        continue;
      }
      await this.circlesService.upsertById(id, data, themeLabels);
    }
    this.logger.log(`Seeded ${SEED_CIRCLES.length} circles`);
  }
}
