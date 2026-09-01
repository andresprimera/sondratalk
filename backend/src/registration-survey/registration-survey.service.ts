import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  RegistrationSurvey,
  RegistrationSurveyDocument,
} from './schemas/registration-survey.schema';
import type {
  AdminRegistrationSurvey,
  SubmitRegistrationSurveyInput,
} from './dto';

type AggRow = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  intent: string;
  ageRange: string;
  realConversations: string;
  daysSpent: string;
  distanceFromHome: string;
  circles: string[];
  blocker: string;
  userName: string;
  userEmail: string;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class RegistrationSurveyService {
  private readonly logger = new Logger(RegistrationSurveyService.name);

  constructor(
    @InjectModel(RegistrationSurvey.name)
    private registrationSurveyModel: Model<RegistrationSurvey>,
  ) {}

  // Upserts the survey for a user. The registration flow submits this once,
  // right after the account is created; upserting keeps a retry idempotent
  // instead of erroring on the unique userId index.
  async upsert(
    userId: string,
    dto: SubmitRegistrationSurveyInput,
  ): Promise<RegistrationSurveyDocument> {
    const doc = await this.registrationSurveyModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $set: dto },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    this.logger.log(`Saved registration survey user=${userId}`);

    return doc;
  }

  async findAllForAdmin(
    page: number,
    limit: number,
  ): Promise<{ data: AdminRegistrationSurvey[]; total: number }> {
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      this.registrationSurveyModel.aggregate<AggRow>([
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'userDoc',
          },
        },
        { $unwind: { path: '$userDoc', preserveNullAndEmptyArrays: false } },
        {
          $project: {
            _id: 1,
            userId: 1,
            intent: 1,
            ageRange: 1,
            realConversations: 1,
            daysSpent: 1,
            distanceFromHome: 1,
            circles: 1,
            blocker: 1,
            userName: '$userDoc.name',
            userEmail: '$userDoc.email',
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ]),
      this.registrationSurveyModel.countDocuments(),
    ]);

    return {
      data: rows.map(
        (r): AdminRegistrationSurvey => ({
          id: r._id.toString(),
          userId: r.userId.toString(),
          // eslint-disable-next-line no-restricted-syntax
          intent: r.intent as AdminRegistrationSurvey['intent'],
          // eslint-disable-next-line no-restricted-syntax
          ageRange: r.ageRange as AdminRegistrationSurvey['ageRange'],
          realConversations:
            // eslint-disable-next-line no-restricted-syntax
            r.realConversations as AdminRegistrationSurvey['realConversations'],
          daysSpent: r.daysSpent,
          distanceFromHome:
            // eslint-disable-next-line no-restricted-syntax
            r.distanceFromHome as AdminRegistrationSurvey['distanceFromHome'],
          circles: r.circles,
          blocker: r.blocker,
          userName: r.userName,
          userEmail: r.userEmail,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        }),
      ),
      total,
    };
  }
}
