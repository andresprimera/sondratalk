import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  generateText,
  streamText,
  type LanguageModel,
  type StreamTextResult,
  type ToolSet,
} from 'ai';
import { AGENT_MODEL, type AgentOptions, type AgentResult } from './agent.types';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    @Inject(AGENT_MODEL)
    private readonly model: LanguageModel,
  ) {}

  async generate(options: AgentOptions): Promise<AgentResult> {
    this.logger.log('Generating text response');

    const result = await generateText({
      model: this.model,
      system: options.systemPrompt,
      prompt: options.userMessage,
      maxOutputTokens: options.maxOutputTokens,
      temperature: options.temperature,
    });

    this.logger.log(
      `Generated response: ${result.usage.totalTokens ?? 0} total tokens`,
    );

    return {
      text: result.text,
      usage: {
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        totalTokens: result.usage.totalTokens,
      },
    };
  }

  stream(options: AgentOptions): StreamTextResult<ToolSet, never> {
    this.logger.log('Starting text stream');

    return streamText({
      model: this.model,
      system: options.systemPrompt,
      prompt: options.userMessage,
      maxOutputTokens: options.maxOutputTokens,
      temperature: options.temperature,
    });
  }
}
