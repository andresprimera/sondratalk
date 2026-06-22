import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Headers,
  UseGuards,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CirclesService } from './circles.service';
import { toCircle, toCircleFromAgg } from './circle.mapper';
import { ThemesService } from '../themes/themes.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  type AdminCircle,
  type Circle,
  type PaginatedResponse,
  LOCALE_KEYS,
  type LocaleKey,
} from '@base-dashboard/shared';
import {
  createCircleSchema,
  type CreateCircleInput,
  updateCircleSchema,
  type UpdateCircleInput,
  circleSearchQuerySchema,
  type CircleSearchQuery,
  verifyCirclePasswordSchema,
  type VerifyCirclePasswordInput,
} from './dto';

function isLocaleKey(s: string): s is LocaleKey {
  // eslint-disable-next-line no-restricted-syntax -- narrow the readonly tuple to readonly string[] for `.includes`
  return (LOCALE_KEYS as readonly string[]).includes(s);
}

function resolveLocale(
  queryLocale: string | undefined,
  acceptLanguage: string | undefined,
): LocaleKey {
  if (queryLocale && isLocaleKey(queryLocale)) {
    return queryLocale;
  }
  if (acceptLanguage) {
    const primarySubtag = acceptLanguage
      .split(',')[0]
      ?.trim()
      .split(';')[0]
      ?.trim()
      .split('-')[0]
      ?.toLowerCase();
    if (primarySubtag && isLocaleKey(primarySubtag)) {
      return primarySubtag;
    }
  }
  return 'en';
}

@Controller('circles')
export class CirclesController {
  constructor(
    private readonly circlesService: CirclesService,
    private readonly themesService: ThemesService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  async create(
    @Body(new ZodValidationPipe(createCircleSchema)) dto: CreateCircleInput,
  ): Promise<Circle> {
    const slugTaken = await this.circlesService.findBySlugExists(dto.slug);
    if (slugTaken) {
      throw new ConflictException('Slug already in use');
    }
    const theme = await this.themesService.findById(dto.themeId);
    if (!theme) {
      throw new BadRequestException('Theme not found');
    }
    const doc = await this.circlesService.create(dto, {
      en: theme.labels.en,
      es: theme.labels.es,
    });
    return toCircle(doc);
  }

  @Get()
  async findAll(
    @Query(new ZodValidationPipe(circleSearchQuerySchema))
    query: CircleSearchQuery,
    @Headers('accept-language') acceptLanguage: string | undefined,
  ): Promise<PaginatedResponse<Circle>> {
    const { q, themeId, page, limit, locale: queryLocale } = query;
    const locale = resolveLocale(queryLocale, acceptLanguage);
    const { data, total } = q
      ? await this.circlesService.searchPaginated(q, page, limit, locale, themeId)
      : await this.circlesService.findAllPaginated(page, limit, themeId);
    return {
      data: data.map(toCircle),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async findAllForAdmin(
    @Query(new ZodValidationPipe(circleSearchQuerySchema))
    query: CircleSearchQuery,
    @Headers('accept-language') acceptLanguage: string | undefined,
  ): Promise<PaginatedResponse<AdminCircle>> {
    const { q, themeId, page, limit, locale: queryLocale, sortBy, sortDir } = query;
    const locale = resolveLocale(queryLocale, acceptLanguage);
    const { data, total } = q
      ? await this.circlesService.searchPaginatedForAdmin(q, page, limit, locale, themeId, sortBy, sortDir)
      : await this.circlesService.findAllPaginatedForAdmin(page, limit, themeId, sortBy, sortDir);
    return {
      data: data.map(toCircleFromAgg),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  @Get('all')
  async findAllUnpaginated(): Promise<Circle[]> {
    const docs = await this.circlesService.findAll();
    return docs.map(toCircle);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Circle> {
    const doc = await this.circlesService.findById(id);
    if (!doc) {
      throw new NotFoundException('Circle not found');
    }
    return toCircle(doc);
  }

  @Post(':id/verify-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async verifyPassword(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(verifyCirclePasswordSchema))
    dto: VerifyCirclePasswordInput,
  ): Promise<void> {
    const doc = await this.circlesService.findByIdWithPassword(id);
    if (!doc) {
      throw new NotFoundException('Circle not found');
    }
    if (!doc.isPrivate) {
      throw new BadRequestException('Circle is not private');
    }
    const valid = await this.circlesService.verifyPassword(doc, dto.password);
    if (!valid) {
      // 403, not 401 — a wrong circle password isn't an auth-token problem,
      // and authFetch treats every 401 as session expiry (silent refresh + retry).
      throw new ForbiddenException('Incorrect password');
    }
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCircleSchema)) dto: UpdateCircleInput,
  ): Promise<Circle> {
    const current = await this.circlesService.findById(id);
    if (!current) {
      throw new NotFoundException('Circle not found');
    }
    if (dto.slug && current.slug !== dto.slug) {
      const exists = await this.circlesService.findBySlugExists(dto.slug);
      if (exists) {
        throw new ConflictException('Slug already in use');
      }
    }
    let themeLabels: { en: string; es: string } | undefined;
    if (dto.themeId) {
      const theme = await this.themesService.findById(dto.themeId);
      if (!theme) {
        throw new BadRequestException('Theme not found');
      }
      themeLabels = { en: theme.labels.en, es: theme.labels.es };
    }
    const doc = await this.circlesService.update(id, dto, themeLabels);
    if (!doc) {
      throw new NotFoundException('Circle not found');
    }
    return toCircle(doc);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.circlesService.remove(id);
  }
}
