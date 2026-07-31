import type { LlmConfig } from '../llm/types.ts'

export function llmConfig(env: Record<string, string | undefined> = process.env): LlmConfig {
  const maxTokens = Number.parseInt(env.LLM_MAX_TOKENS ?? '4096', 10)
  if (!Number.isInteger(maxTokens) || maxTokens < 256 || maxTokens > 128_000) {
    throw new Error('LLM_MAX_TOKENS must be an integer from 256 to 128000')
  }
  return {
    provider: (env.LLM_PROVIDER ?? '').trim(),
    model: (env.LLM_MODEL ?? '').trim(),
    baseUrl: (env.LLM_BASE_URL ?? '').trim().replace(/\/$/, ''),
    apiKey: (env.LLM_API_KEY ?? '').trim(),
    maxTokens,
    fixture: env.STORYLINT_FIXTURE_LLM === '1',
  }
}
