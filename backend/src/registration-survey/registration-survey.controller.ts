import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { RegistrationSurveyService } from './registration-survey.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  submitRegistrationSurveySchema,
  type AdminRegistrationSurvey,
  type RegistrationSurvey,
  type SubmitRegistrationSurveyInput,
} from './dto';
import {
  paginationQuerySchema,
  type PaginationQuery,
} from '../common/dto/pagination-query.dto';
import { type PaginatedResponse } from '@base-dashboard/shared';
import { toRegistrationSurvey } from './registration-survey.mapper';

@Controller('registration-surveys')
export class RegistrationSurveyController {
  constructor(
    private registrationSurveyService: RegistrationSurveyService,
  ) {}

  @Post()
  async submit(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(submitRegistrationSurveySchema))
    dto: SubmitRegistrationSurveyInput,
  ): Promise<RegistrationSurvey> {
    const doc = await this.registrationSurveyService.upsert(userId, dto);
    return toRegistrationSurvey(doc);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin')
  async findAll(
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<PaginatedResponse<AdminRegistrationSurvey>> {
    const { data, total } =
      await this.registrationSurveyService.findAllForAdmin(
        query.page,
        query.limit,
      );
    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }
}
