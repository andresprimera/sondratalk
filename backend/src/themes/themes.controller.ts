import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  NotFoundException,
  ConflictException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ThemesService } from './themes.service';
import { ThemeDocument } from './schemas/theme.schema';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  type Theme,
  type PaginatedResponse,
  paginationQuerySchema,
  type PaginationQuery,
} from '@base-dashboard/shared';
import {
  createThemeSchema,
  type CreateThemeInput,
  updateThemeSchema,
  type UpdateThemeInput,
} from './dto';

function toTheme(doc: ThemeDocument): Theme {
  return {
    id: doc.id,
    slug: doc.slug,
    labels: { en: doc.labels.en, es: doc.labels.es },
    sortOrder: doc.sortOrder,
  };
}

@Controller('themes')
@UseGuards(RolesGuard)
@Roles('admin')
export class ThemesController {
  constructor(private readonly themesService: ThemesService) {}

  @Post()
  async create(
    @Body(new ZodValidationPipe(createThemeSchema)) dto: CreateThemeInput,
  ): Promise<Theme> {
    const exists = await this.themesService.findBySlugExists(dto.slug);
    if (exists) {
      throw new ConflictException('Slug already in use');
    }
    const doc = await this.themesService.create(dto);
    return toTheme(doc);
  }

  @Get()
  async findAll(
    @Query(new ZodValidationPipe(paginationQuerySchema))
    query: PaginationQuery,
  ): Promise<PaginatedResponse<Theme>> {
    const { data, total } = await this.themesService.findAllPaginated(
      query.page,
      query.limit,
    );
    return {
      data: data.map(toTheme),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  @Get('all')
  async findAllUnpaginated(): Promise<Theme[]> {
    const docs = await this.themesService.findAll();
    return docs.map(toTheme);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Theme> {
    const doc = await this.themesService.findById(id);
    if (!doc) {
      throw new NotFoundException('Theme not found');
    }
    return toTheme(doc);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateThemeSchema)) dto: UpdateThemeInput,
  ): Promise<Theme> {
    if (dto.slug) {
      const current = await this.themesService.findById(id);
      if (current && current.slug !== dto.slug) {
        const exists = await this.themesService.findBySlugExists(dto.slug);
        if (exists) {
          throw new ConflictException('Slug already in use');
        }
      }
    }
    const doc = await this.themesService.update(id, dto);
    if (!doc) {
      throw new NotFoundException('Theme not found');
    }
    return toTheme(doc);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.themesService.remove(id);
  }
}
