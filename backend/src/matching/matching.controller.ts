import { Body, Controller, Post } from '@nestjs/common';
import { MatchingService } from './matching.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  findTalkMatchInputSchema,
  type FindTalkMatchInput,
  findHeardMatchInputSchema,
  type FindHeardMatchInput,
  type HeardMatchesResponse,
  type TalkMatchesResponse,
} from './dto';

@Controller('matching')
export class MatchingController {
  constructor(private matchingService: MatchingService) {}

  @Post('talk')
  async findTalk(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(findTalkMatchInputSchema))
    dto: FindTalkMatchInput,
  ): Promise<TalkMatchesResponse> {
    return this.matchingService.findTalkMatch(userId, dto.circleIds);
  }

  @Post('heard')
  async findHeard(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(findHeardMatchInputSchema))
    dto: FindHeardMatchInput,
  ): Promise<HeardMatchesResponse> {
    return this.matchingService.findHeardMatch(userId, dto.circleIds);
  }
}
