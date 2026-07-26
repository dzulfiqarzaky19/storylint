export type LlmConfig = {
  provider: string
  model: string
  baseUrl: string
  apiKey: string
  maxTokens: number
  fixture: boolean
}

export function hasLiveLlm(config: LlmConfig): boolean {
  return Boolean(config.model && config.baseUrl)
}
