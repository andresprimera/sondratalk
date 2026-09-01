import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  RegistrationSurvey,
  RegistrationSurveySchema,
} from './schemas/registration-survey.schema';
import { RegistrationSurveyController } from './registration-survey.controller';
import { RegistrationSurveyService } from './registration-survey.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RegistrationSurvey.name, schema: RegistrationSurveySchema },
    ]),
  ],
  controllers: [RegistrationSurveyController],
  providers: [RegistrationSurveyService],
})
export class RegistrationSurveyModule {}
