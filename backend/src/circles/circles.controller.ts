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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CirclesService } from './circles.service';
import { CircleDocument } from './schemas/circle.schema';
import { ThemesService } from '../themes/themes.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
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
} from './dto';

function toCircle(doc: CircleDocument): Circle {
  return {
    id: doc.id,
    slug: doc.slug,
    themeId: doc.themeId.toString(),
    labels: { en: doc.labels.en, es: doc.labels.es },
    aliases: { en: doc.aliases.en, es: doc.aliases.es },
    popularity: doc.popularity,
  };
}

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
@UseGuards(RolesGuard)
@Roles('admin')
export class CirclesController {
  constructor(
    private readonly circlesService: CirclesService,
    private readonly themesService: ThemesService,
  ) {}

  @Post()
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
    const doc = await this.circlesService.create(dto);
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

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Circle> {
    const doc = await this.circlesService.findById(id);
    if (!doc) {
      throw new NotFoundException('Circle not found');
    }
    return toCircle(doc);
  }

  @Patch(':id')
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
    if (dto.themeId) {
      const theme = await this.themesService.findById(dto.themeId);
      if (!theme) {
        throw new BadRequestException('Theme not found');
      }
    }
    const doc = await this.circlesService.update(id, dto);
    if (!doc) {
      throw new NotFoundException('Circle not found');
    }
    return toCircle(doc);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.circlesService.remove(id);
  }
}
