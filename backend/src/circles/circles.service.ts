import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, PipelineStage, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { LOCALE_KEYS, type CircleSortBy, type LocaleKey } from '@base-dashboard/shared';
import { Circle, CircleDocument } from './schemas/circle.schema';
import { CreateCircleInput, UpdateCircleInput } from './dto';

const PASSWORD_SALT_ROUNDS = 12;

// Name of the Atlas Search index defined on the `circles` collection.
// Must match the index name shown in Atlas → Search tab. The index
// definition itself is documented in backend/src/circles/atlas-search-index.json.
const CIRCLES_SEARCH_INDEX = 'circles_search';

// Collection name backing the Membership schema — see
// backend/src/memberships/schemas/membership.schema.ts (`collection: 'circle_memberships'`).
const CIRCLE_MEMBERSHIPS_COLLECTION = 'circle_memberships';

export interface ThemeLabelsSnapshot {
  en: string;
  es: string;
}

// Raw aggregate POJO — not a hydrated Mongoose document, since
// `membershipCount` is computed in the pipeline and isn't a schema path.
export type AdminCircleAggRow = {
  _id: Types.ObjectId;
  slug: string;
  themeId: Types.ObjectId;
  type: string;
  labels: { en: string; es: string };
  aliases: { en: string[]; es: string[] };
  popularity: number;
  isPrivate: boolean;
  membershipCount: number;
};

type AdminCircleFacetResult = {
  data: AdminCircleAggRow[];
  total: [{ n: number }];
};

const ADMIN_CIRCLE_SORT_FIELDS: Record<CircleSortBy, string> = {
  slug: 'slug',
  labelEn: 'labels.en',
  labelEs: 'labels.es',
  theme: 'themeLabels.en',
  type: 'type',
  popularity: 'membershipCount',
};

interface SearchCompound {
  should: Record<string, unknown>[];
  minimumShouldMatch: number;
  filter?: Record<string, unknown>[];
}

@Injectable()
export class CirclesService {
  constructor(
    @InjectModel(Circle.name) private circleModel: Model<Circle>,
  ) {}

  async create(
    dto: CreateCircleInput,
    themeLabels: ThemeLabelsSnapshot,
  ): Promise<CircleDocument> {
    const aliases = dto.aliases ?? { en: [], es: [] };
    const password = dto.password
      ? await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS)
      : undefined;
    return this.circleModel.create({
      ...dto,
      aliases,
      themeLabels,
      password,
    });
  }

  async findAll(): Promise<CircleDocument[]> {
    return this.circleModel.find().sort({ popularity: -1, slug: 1 });
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

  private buildSearchCompound(
    q: string,
    locale: LocaleKey,
    themeId?: string,
  ): SearchCompound {
    if (!LOCALE_KEYS.includes(locale)) {
      throw new Error(`Unsupported locale: ${locale}`);
    }

    const labelPath = `labels.${locale}`;
    const aliasPath = `aliases.${locale}`;
    const themePath = `themeLabels.${locale}`;

    return {
      should: [
        { autocomplete: { query: q, path: labelPath } },
        { autocomplete: { query: q, path: aliasPath } },
        { autocomplete: { query: q, path: themePath } },
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
  }

  async searchPaginated(
    q: string,
    page: number,
    limit: number,
    locale: LocaleKey,
    themeId?: string,
  ): Promise<{ data: CircleDocument[]; total: number }> {
    const compound = this.buildSearchCompound(q, locale, themeId);
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

    const [rawHits, meta] = await Promise.all([
      this.circleModel.aggregate(searchPipeline).exec(),
      this.circleModel
        .aggregate<{ count: { lowerBound?: number; total?: number } }>(
          metaPipeline,
        )
        .exec(),
    ]);

    // Aggregation returns raw POJOs without Mongoose virtuals (notably `id`).
    // Hydrate so callers can read `doc.id` consistently with `find()` results.
    const hits = rawHits.map((doc) => this.circleModel.hydrate(doc));

    const total = meta[0]?.count?.total ?? meta[0]?.count?.lowerBound ?? 0;

    return { data: hits, total };
  }

  async findAllPaginatedForAdmin(
    page: number,
    limit: number,
    themeId?: string,
    sortBy: CircleSortBy = 'slug',
    sortDir: 'asc' | 'desc' = 'asc',
  ): Promise<{ data: AdminCircleAggRow[]; total: number }> {
    const skip = (page - 1) * limit;
    const sortOrder = sortDir === 'asc' ? 1 : -1;
    const sortField = ADMIN_CIRCLE_SORT_FIELDS[sortBy];

    const [result] = await this.circleModel.aggregate<AdminCircleFacetResult>([
      ...(themeId ? [{ $match: { themeId: new Types.ObjectId(themeId) } }] : []),
      {
        $lookup: {
          from: CIRCLE_MEMBERSHIPS_COLLECTION,
          localField: '_id',
          foreignField: 'circleId',
          as: 'memberships',
        },
      },
      { $addFields: { membershipCount: { $size: '$memberships' } } },
      { $project: { memberships: 0, password: 0 } },
      { $sort: { [sortField]: sortOrder } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'n' }],
        },
      },
    ]);

    const total = result?.total[0]?.n ?? 0;
    const data = result?.data ?? [];
    return { data, total };
  }

  async searchPaginatedForAdmin(
    q: string,
    page: number,
    limit: number,
    locale: LocaleKey,
    themeId?: string,
    sortBy: CircleSortBy = 'slug',
    sortDir: 'asc' | 'desc' = 'asc',
  ): Promise<{ data: AdminCircleAggRow[]; total: number }> {
    const compound = this.buildSearchCompound(q, locale, themeId);
    const skip = (page - 1) * limit;
    const sortOrder = sortDir === 'asc' ? 1 : -1;
    const sortField = ADMIN_CIRCLE_SORT_FIELDS[sortBy];

    // Atlas Search emits `searchScore` meta which Mongoose's PipelineStage
    // typing doesn't recognize (it only knows `textScore`/`indexKey`). Cast
    // the assembled pipelines to PipelineStage[] to escape the narrow typing.
    // The requested column sort takes priority; relevance score is kept as
    // a tiebreaker so equally-sorted rows still favor closer search matches.
    const searchPipeline = [
      { $search: { index: CIRCLES_SEARCH_INDEX, compound } },
      {
        $lookup: {
          from: CIRCLE_MEMBERSHIPS_COLLECTION,
          localField: '_id',
          foreignField: 'circleId',
          as: 'memberships',
        },
      },
      { $addFields: { membershipCount: { $size: '$memberships' } } },
      { $project: { memberships: 0, password: 0 } },
      { $sort: { [sortField]: sortOrder, score: { $meta: 'searchScore' } } },
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

    const [data, meta] = await Promise.all([
      this.circleModel.aggregate<AdminCircleAggRow>(searchPipeline).exec(),
      this.circleModel
        .aggregate<{ count: { lowerBound?: number; total?: number } }>(
          metaPipeline,
        )
        .exec(),
    ]);

    const total = meta[0]?.count?.total ?? meta[0]?.count?.lowerBound ?? 0;

    return { data, total };
  }

  async findById(id: string): Promise<CircleDocument | null> {
    return this.circleModel.findById(id);
  }

  async findByIdWithPassword(id: string): Promise<CircleDocument | null> {
    return this.circleModel.findById(id).select('+password');
  }

  async verifyPassword(
    circle: CircleDocument,
    password: string,
  ): Promise<boolean> {
    if (!circle.password) return false;
    return bcrypt.compare(password, circle.password);
  }

  async findByIds(ids: string[]): Promise<CircleDocument[]> {
    if (ids.length === 0) return [];
    const objectIds = ids.map((id) => new Types.ObjectId(id));
    return this.circleModel.find({ _id: { $in: objectIds } });
  }

  async findBySlugExists(slug: string): Promise<boolean> {
    return this.circleModel.exists({ slug }).then((r) => r !== null);
  }

  async update(
    id: string,
    dto: UpdateCircleInput,
    themeLabels?: ThemeLabelsSnapshot,
  ): Promise<CircleDocument | null> {
    // A partial dto alone can't tell us whether a circle already has a
    // password (e.g. renaming an already-private circle without resending
    // it), so check against the existing document instead of the payload.
    const current = await this.circleModel.findById(id).select('+password');
    if (!current) return null;

    const willBePrivate = dto.isPrivate ?? current.isPrivate;
    const willHavePassword = dto.password ? true : Boolean(current.password);
    if (willBePrivate && !willHavePassword) {
      throw new BadRequestException('Password is required for private circles');
    }

    const { password, ...rest } = dto;
    const set: Record<string, unknown> = themeLabels
      ? { ...rest, themeLabels }
      : { ...rest };
    if (password) {
      set.password = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
    }

    // Un-privating clears the old hash so it can't be silently revived later
    // by re-privating without supplying a new password. A password can't be
    // in both $set and $unset in the same update, so drop it from $set here.
    if (dto.isPrivate === false) {
      delete set.password;
      return this.circleModel.findByIdAndUpdate(
        id,
        { $set: set, $unset: { password: '' } },
        { new: true },
      );
    }
    return this.circleModel.findByIdAndUpdate(id, set, { new: true });
  }

  async upsertById(
    id: string,
    data: CreateCircleInput,
    themeLabels: ThemeLabelsSnapshot,
  ): Promise<CircleDocument | null> {
    const aliases = data.aliases ?? { en: [], es: [] };
    const password = data.password
      ? await bcrypt.hash(data.password, PASSWORD_SALT_ROUNDS)
      : undefined;
    return this.circleModel.findByIdAndUpdate(
      id,
      { ...data, aliases, themeLabels, password },
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

  // Bulk delete used by the catalog reset. Uses deleteMany (not collection
  // drop) so the Atlas Search index and schema indexes survive. Does NOT
  // cascade memberships — the reset cleans those separately.
  async removeAll(): Promise<void> {
    await this.circleModel.deleteMany({});
  }
}
