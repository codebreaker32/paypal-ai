import Anthropic from '@anthropic-ai/sdk';

export const MODEL_ID = 'claude-sonnet-5-5';

let client: Anthropic | null = null;

/** Singleton client. Reads ANTHROPIC_API_KEY from the environment. */
export function getAnthropic(): Anthropic {
  client ??= new Anthropic();
  return client;
}
