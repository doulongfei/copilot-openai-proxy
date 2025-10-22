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

// OpenAI API Types - Message Content Parts
export interface TextPart {
  type: 'text'
  text: string
}

export interface ImageUrlPart {
  type: 'image_url'
  image_url: {
    url: string
    detail?: 'auto' | 'low' | 'high'
  }
}

export type MessageContent = string | Array<TextPart | ImageUrlPart>

export interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: MessageContent
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

// Model Capabilities (根据实际 Copilot API 响应)
export interface ModelSupports {
  vision?: boolean
  streaming?: boolean
  tool_calls?: boolean
  parallel_tool_calls?: boolean
  structured_outputs?: boolean
  dimensions?: boolean
  max_thinking_budget?: number
  min_thinking_budget?: number
  [key: string]: any
}

export interface ModelLimits {
  max_context_window_tokens?: number
  max_output_tokens?: number
  max_prompt_tokens?: number
  max_inputs?: number
  vision?: {
    max_prompt_image_size: number
    max_prompt_images: number
    supported_media_types: string[]
  }
  [key: string]: any
}

export interface ModelCapabilities {
  family?: string
  type?: string
  tokenizer?: string
  object?: string
  supports?: ModelSupports
  limits?: ModelLimits
  [key: string]: any
}

export interface ModelInfo {
  id: string
  object: string
  name?: string
  version?: string
  vendor?: string
  preview?: boolean
  model_picker_enabled?: boolean
  model_picker_category?: string
  capabilities?: ModelCapabilities
  supported_endpoints?: string[]
  policy?: {
    state?: string
    terms?: string
  }
  [key: string]: any
}

export interface ModelsResponse {
  object: string
  data: ModelInfo[]
}
