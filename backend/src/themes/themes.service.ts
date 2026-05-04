import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Theme, ThemeDocument } from './schemas/theme.schema';
import { CreateThemeInput, UpdateThemeInput } from './dto';

@Injectable()
export class ThemesService {
  constructor(
    @InjectModel(Theme.name) private themeModel: Model<Theme>,
  ) {}

  async create(dto: CreateThemeInput): Promise<ThemeDocument> {
    return this.themeModel.create(dto);
  }

  async findAll(): Promise<ThemeDocument[]> {
    return this.themeModel.find().sort({ sortOrder: 1, 'labels.en': 1 });
  }

  async findAllPaginated(
    page: number,
    limit: number,
  ): Promise<{ data: ThemeDocument[]; total: number }> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.themeModel
        .find()
        .sort({ sortOrder: 1, 'labels.en': 1 })
        .skip(skip)
        .limit(limit),
      this.themeModel.countDocuments(),
    ]);
    return { data, total };
  }

  async findById(id: string): Promise<ThemeDocument | null> {
    return this.themeModel.findById(id);
  }

  async findBySlugExists(slug: string): Promise<boolean> {
    return this.themeModel.exists({ slug }).then((r) => r !== null);
  }

  async update(
    id: string,
    dto: UpdateThemeInput,
  ): Promise<ThemeDocument | null> {
    return this.themeModel.findByIdAndUpdate(id, dto, { new: true });
  }

  async upsertById(
    id: string,
    data: CreateThemeInput,
  ): Promise<ThemeDocument | null> {
    return this.themeModel.findByIdAndUpdate(id, data, {
      upsert: true,
      setDefaultsOnInsert: true,
      new: true,
    });
  }

  async remove(id: string): Promise<void> {
    await this.themeModel.findByIdAndDelete(id);
  }
}
