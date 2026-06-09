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
import { AllowlistService } from './allowlist.service';
import { AllowlistEntryDocument } from './schemas/allowlist-entry.schema';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  type AllowlistEntry,
  type PaginatedResponse,
  paginationQuerySchema,
  type PaginationQuery,
} from '@base-dashboard/shared';
import {
  createAllowlistEntrySchema,
  type CreateAllowlistEntryInput,
  updateAllowlistEntrySchema,
  type UpdateAllowlistEntryInput,
} from './dto';

function toAllowlistEntry(doc: AllowlistEntryDocument): AllowlistEntry {
  return {
    id: doc.id,
    value: doc.value,
    note: doc.note ?? null,
    createdAt: doc.createdAt.toISOString(),
  };
}

@Controller('allowlist')
@UseGuards(RolesGuard)
@Roles('admin')
export class AllowlistController {
  constructor(private readonly allowlistService: AllowlistService) {}

  @Post()
  async create(
    @Body(new ZodValidationPipe(createAllowlistEntrySchema))
    dto: CreateAllowlistEntryInput,
  ): Promise<AllowlistEntry> {
    const exists = await this.allowlistService.findByValueExists(dto.value);
    if (exists) {
      throw new ConflictException('Entry already in early access list');
    }
    const doc = await this.allowlistService.create(dto);
    return toAllowlistEntry(doc);
  }

  @Get()
  async findAll(
    @Query(new ZodValidationPipe(paginationQuerySchema))
    query: PaginationQuery,
  ): Promise<PaginatedResponse<AllowlistEntry>> {
    const { data, total } = await this.allowlistService.findAllPaginated(
      query.page,
      query.limit,
    );
    return {
      data: data.map(toAllowlistEntry),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<AllowlistEntry> {
    const doc = await this.allowlistService.findById(id);
    if (!doc) {
      throw new NotFoundException('Early access entry not found');
    }
    return toAllowlistEntry(doc);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAllowlistEntrySchema))
    dto: UpdateAllowlistEntryInput,
  ): Promise<AllowlistEntry> {
    if (dto.value) {
      const current = await this.allowlistService.findById(id);
      if (current && current.value !== dto.value) {
        const exists = await this.allowlistService.findByValueExists(dto.value);
        if (exists) {
          throw new ConflictException('Entry already in early access list');
        }
      }
    }
    const doc = await this.allowlistService.update(id, dto);
    if (!doc) {
      throw new NotFoundException('Early access entry not found');
    }
    return toAllowlistEntry(doc);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.allowlistService.remove(id);
  }
}
