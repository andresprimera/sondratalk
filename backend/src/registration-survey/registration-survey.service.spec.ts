import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { RegistrationSurveyService } from './registration-survey.service';
import { RegistrationSurvey } from './schemas/registration-survey.schema';
import type { SubmitRegistrationSurveyInput } from './dto';

const USER_ID = '507f1f77bcf86cd799439012';

const SAMPLE_INPUT: SubmitRegistrationSurveyInput = {
  intent: 'deeper',
  ageRange: '35-44',
  realConversations: 'no',
  daysSpent: 'At home',
  distanceFromHome: 'another-country',
  circles: ['Parenthood', 'Building something'],
  blocker: "It'll be awkward",
};

describe('RegistrationSurveyService', () => {
  let service: RegistrationSurveyService;
  const registrationSurveyModel = {
    findOneAndUpdate: jest.fn(),
    aggregate: jest.fn(),
    countDocuments: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistrationSurveyService,
        {
          provide: getModelToken(RegistrationSurvey.name),
          useValue: registrationSurveyModel,
        },
      ],
    }).compile();
    service = module.get<RegistrationSurveyService>(RegistrationSurveyService);
  });

  describe('upsert', () => {
    it('upserts the survey keyed by userId', async () => {
      const saved = { id: 'rs-1' };
      registrationSurveyModel.findOneAndUpdate.mockResolvedValue(saved);

      const result = await service.upsert(USER_ID, SAMPLE_INPUT);

      const [filter, update, options] =
        registrationSurveyModel.findOneAndUpdate.mock.calls[0];
      expect(filter.userId.toString()).toBe(USER_ID);
      expect(update.$set).toEqual(SAMPLE_INPUT);
      expect(options).toMatchObject({ upsert: true, new: true });
      expect(result).toBe(saved);
    });
  });

  describe('findAllForAdmin', () => {
    it('joins user info and returns paginated rows with total', async () => {
      const createdAt = new Date('2026-01-01T00:00:00.000Z');
      const updatedAt = new Date('2026-01-02T00:00:00.000Z');
      registrationSurveyModel.aggregate.mockResolvedValue([
        {
          _id: { toString: () => 'rs-1' },
          userId: { toString: () => USER_ID },
          intent: 'deeper',
          ageRange: '35-44',
          realConversations: 'no',
          daysSpent: 'At home',
          distanceFromHome: 'another-country',
          circles: ['Parenthood'],
          blocker: "It'll be awkward",
          userName: 'Ada',
          userEmail: 'ada@example.com',
          createdAt,
          updatedAt,
        },
      ]);
      registrationSurveyModel.countDocuments.mockResolvedValue(1);

      const result = await service.findAllForAdmin(1, 20);

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual({
        id: 'rs-1',
        userId: USER_ID,
        intent: 'deeper',
        ageRange: '35-44',
        realConversations: 'no',
        daysSpent: 'At home',
        distanceFromHome: 'another-country',
        circles: ['Parenthood'],
        blocker: "It'll be awkward",
        userName: 'Ada',
        userEmail: 'ada@example.com',
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      });
    });

    it('applies skip/limit for the requested page', async () => {
      registrationSurveyModel.aggregate.mockResolvedValue([]);
      registrationSurveyModel.countDocuments.mockResolvedValue(0);

      await service.findAllForAdmin(3, 10);

      const pipeline = registrationSurveyModel.aggregate.mock.calls[0][0];
      expect(pipeline).toContainEqual({ $skip: 20 });
      expect(pipeline).toContainEqual({ $limit: 10 });
    });
  });
});
