// GitHub OAuth Types
export interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

export interface AccessTokenResponse {
  access_token?: string
  error?: string
}

export interface CopilotTokenResponse {
  token: string
  expires_at: number
  refresh_in?: number
}

export interface GitHubUserResponse {
  login: string
  avatar_url: string
  name: string
  email: string
}

// Storage Types
export interface StoredAuth {
  accessToken: string
  copilotToken?: string
  copilotTokenExpiresAt?: number
  user?: {
    login: string
    avatar: string
    name?: string
  }
  createdAt: number
  updatedAt: number
}

// OpenAI API Types
export interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface OpenAIChatCompletionRequest {
  model: string
  messages: OpenAIChatMessage[]
  temperature?: number
  top_p?: number
  n?: number
  stream?: boolean
  stop?: string | string[]
  max_tokens?: number
  presence_penalty?: number
  frequency_penalty?: number
}

export interface OpenAIChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: {
    index: number
    message: OpenAIChatMessage
    finish_reason: string
  }[]
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface OpenAIModelResponse {
  id: string
  object: string
  created: number
  owned_by: string
}
