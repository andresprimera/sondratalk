import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, PipelineStage, Types } from 'mongoose';
import { LOCALE_KEYS, type LocaleKey } from '@base-dashboard/shared';
import { Circle, CircleDocument } from './schemas/circle.schema';
import { CreateCircleInput, UpdateCircleInput } from './dto';

// Name of the Atlas Search index defined on the `circles` collection.
// Must match the index name shown in Atlas → Search tab. The index
// definition itself is documented in backend/src/circles/atlas-search-index.json.
const CIRCLES_SEARCH_INDEX = 'circle_search';

@Injectable()
export class CirclesService {
  constructor(
    @InjectModel(Circle.name) private circleModel: Model<Circle>,
  ) {}

  async create(dto: CreateCircleInput): Promise<CircleDocument> {
    const aliases = dto.aliases ?? { en: [], es: [] };
    return this.circleModel.create({ ...dto, aliases });
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
    locale: LocaleKey,
    themeId?: string,
  ): Promise<{ data: CircleDocument[]; total: number }> {
    if (!LOCALE_KEYS.includes(locale)) {
      throw new Error(`Unsupported locale: ${locale}`);
    }

    const labelPath = `labels.${locale}`;
    const aliasPath = `aliases.${locale}`;

    const compound = {
      should: [
        { autocomplete: { query: q, path: labelPath } },
        { autocomplete: { query: q, path: aliasPath } },
        { text: { query: q, path: labelPath, fuzzy: { maxEdits: 1 } } },
      ],
      minimumShouldMatch: 1,
      ...(themeId
        ? {
            filter: [
              { equals: { path: 'themeId', value: new Types.ObjectId(themeId) } },
            ],
          }
        : {}),
    };

    const skip = (page - 1) * limit;

    // Atlas Search emits `searchScore` meta which Mongoose's PipelineStage
    // typing doesn't recognize (it only knows `textScore`/`indexKey`). Cast
    // the assembled pipelines to PipelineStage[] to escape the narrow typing.
    const searchPipeline = [
      { $search: { index: CIRCLES_SEARCH_INDEX, compound } },
      { $sort: { score: { $meta: 'searchScore' }, popularity: -1 } },
      { $skip: skip },
      { $limit: limit },
    ] as unknown as PipelineStage[];
    const metaPipeline = [
      {
        $searchMeta: {
          index: CIRCLES_SEARCH_INDEX,
          compound,
          count: { type: 'total' },
        },
      },
    ] as unknown as PipelineStage[];

    const [hits, meta] = await Promise.all([
      this.circleModel.aggregate<CircleDocument>(searchPipeline).exec(),
      this.circleModel
        .aggregate<{ count: { lowerBound?: number; total?: number } }>(
          metaPipeline,
        )
        .exec(),
    ]);

    const total = meta[0]?.count?.total ?? meta[0]?.count?.lowerBound ?? 0;

    return { data: hits, total };
  }

  async findById(id: string): Promise<CircleDocument | null> {
    return this.circleModel.findById(id);
  }

  async findBySlugExists(slug: string): Promise<boolean> {
    return this.circleModel.exists({ slug }).then((r) => r !== null);
  }

  async update(
    id: string,
    dto: UpdateCircleInput,
  ): Promise<CircleDocument | null> {
    return this.circleModel.findByIdAndUpdate(id, dto, { new: true });
  }

  async upsertById(
    id: string,
    data: CreateCircleInput,
  ): Promise<CircleDocument | null> {
    const aliases = data.aliases ?? { en: [], es: [] };
    return this.circleModel.findByIdAndUpdate(
      id,
      { ...data, aliases },
      {
        upsert: true,
        setDefaultsOnInsert: true,
        new: true,
      },
    );
  }

  async remove(id: string): Promise<void> {
    await this.circleModel.findByIdAndDelete(id);
  }
}
