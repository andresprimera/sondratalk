import { Body, Controller, Post } from '@nestjs/common';
import { CallsService } from './calls.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  callTokenRequestSchema,
  type CallTokenRequest,
  type CallTokenResponse,
} from './dto';

@Controller('calls')
export class CallsController {
  constructor(private callsService: CallsService) {}

  @Post('token')
  async create(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(callTokenRequestSchema))
    dto: CallTokenRequest,
  ): Promise<CallTokenResponse> {
    return this.callsService.generateToken(userId, dto.peerUserId);
  }
}
