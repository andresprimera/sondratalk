import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LanguageModel } from 'ai';
import { AGENT_MODEL, type AgentProvider } from './agent.types';
import { AgentService } from './agent.service';

@Module({
  providers: [
    {
      provide: AGENT_MODEL,
      useFactory: async (
        configService: ConfigService,
      ): Promise<LanguageModel> => {
        const provider =
          configService.getOrThrow<AgentProvider>('AI_PROVIDER');
        const model = configService.getOrThrow<string>('AI_MODEL');

        switch (provider) {
          case 'openai': {
            const { openai } = await import('@ai-sdk/openai');
            return openai(model);
          }
          case 'anthropic': {
            const { anthropic } = await import('@ai-sdk/anthropic');
            return anthropic(model);
          }
          case 'google': {
            const { google } = await import('@ai-sdk/google');
            return google(model);
          }
          default:
            throw new Error(`Unknown AI provider: ${provider}`);
        }
      },
      inject: [ConfigService],
    },
    AgentService,
  ],
  exports: [AgentService],
})
export class AgentModule {}
