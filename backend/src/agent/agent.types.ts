export const AGENT_MODEL = 'AGENT_MODEL';

export type AgentProvider = 'openai' | 'anthropic' | 'google';

export interface AgentOptions {
  systemPrompt: string;
  userMessage: string;
  maxOutputTokens?: number;
  temperature?: number;
}

export interface AgentResult {
  text: string;
  usage: {
    inputTokens: number | undefined;
    outputTokens: number | undefined;
    totalTokens: number | undefined;
  };
}
