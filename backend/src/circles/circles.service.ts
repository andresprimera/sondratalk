import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { Circle, CircleDocument } from './schemas/circle.schema';
import { CreateCircleInput, UpdateCircleInput } from './dto';
import { buildSearchTerms, normalize } from './utils/build-search-terms';

@Injectable()
export class CirclesService {
  constructor(
    @InjectModel(Circle.name) private circleModel: Model<Circle>,
  ) {}

  async create(dto: CreateCircleInput): Promise<CircleDocument> {
    const aliases = dto.aliases ?? { en: [], es: [] };
    const searchTerms = buildSearchTerms(dto.labels, aliases);
    return this.circleModel.create({ ...dto, aliases, searchTerms });
  }

  async findAllPaginated(
    page: number,
    limit: number,
    themeId?: string,
  ): Promise<{ data: CircleDocument[]; total: number }> {
    const filter: FilterQuery<Circle> = themeId ? { themeId } : {};
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.circleModel
        .find(filter)
        .sort({ popularity: -1, slug: 1 })
        .skip(skip)
        .limit(limit),
      this.circleModel.countDocuments(filter),
    ]);
    return { data, total };
  }

  async searchPaginated(
    q: string,
    page: number,
    limit: number,
    themeId?: string,
  ): Promise<{ data: CircleDocument[]; total: number }> {
    const normalizedQ = normalize(q);
    const filter: FilterQuery<Circle> = {
      $text: { $search: normalizedQ },
      ...(themeId ? { themeId } : {}),
    };
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.circleModel
        .find(filter, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' }, popularity: -1 })
        .skip(skip)
        .limit(limit),
      this.circleModel.countDocuments(filter),
    ]);
    return { data, total };
  }

  async findById(id: string): Promise<CircleDocument | null> {
    return this.circleModel.findById(id);
  }

  async findBySlugExists(slug: string): Promise<boolean> {
    return this.circleModel.exists({ slug }).then((r) => r !== null);
  }

  async update(
    existing: CircleDocument,
    dto: UpdateCircleInput,
  ): Promise<CircleDocument | null> {
    if (dto.labels === undefined && dto.aliases === undefined) {
      return this.circleModel.findByIdAndUpdate(existing.id, dto, { new: true });
    }
    const labels = dto.labels ?? {
      en: existing.labels.en,
      es: existing.labels.es,
    };
    const aliases = dto.aliases ?? {
      en: existing.aliases.en,
      es: existing.aliases.es,
    };
    const searchTerms = buildSearchTerms(labels, aliases);
    return this.circleModel.findByIdAndUpdate(
      existing.id,
      { ...dto, searchTerms },
      { new: true },
    );
  }

  async remove(id: string): Promise<void> {
    await this.circleModel.findByIdAndDelete(id);
  }
}
