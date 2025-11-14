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

// ==================== Claude API Types ====================

// Claude Message Content Types
export interface ClaudeTextContent {
  type: 'text'
  text: string
}

export interface ClaudeImageContent {
  type: 'image'
  source: {
    type: 'base64' | 'url'
    media_type: string
    data?: string
    url?: string
  }
}

export interface ClaudeToolUseContent {
  type: 'tool_use'
  id: string
  name: string
  input: any
}

export interface ClaudeToolResultContent {
  type: 'tool_result'
  tool_use_id: string
  content?: string | Array<ClaudeTextContent | ClaudeImageContent>
  is_error?: boolean
}

export type ClaudeContentBlock = 
  | ClaudeTextContent 
  | ClaudeImageContent 
  | ClaudeToolUseContent 
  | ClaudeToolResultContent

// Claude Message Types
export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string | ClaudeContentBlock[]
}

// Claude Tool Definition
export interface ClaudeTool {
  name: string
  description?: string
  input_schema: {
    type: 'object'
    properties: Record<string, any>
    required?: string[]
  }
}

// Claude Tool Choice
export type ClaudeToolChoice = 
  | { type: 'auto' }
  | { type: 'any' }
  | { type: 'tool'; name: string }

// Claude Request
export interface ClaudeMessageRequest {
  model: string
  messages: ClaudeMessage[]
  max_tokens: number
  metadata?: {
    user_id?: string
  }
  stop_sequences?: string[]
  stream?: boolean
  system?: string | Array<{ type: 'text'; text: string }>
  temperature?: number
  top_k?: number
  top_p?: number
  tools?: ClaudeTool[]
  tool_choice?: ClaudeToolChoice
}

// Claude Response
export interface ClaudeMessageResponse {
  id: string
  type: 'message'
  role: 'assistant'
  content: ClaudeContentBlock[]
  model: string
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null
  stop_sequence: string | null
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

// Claude Streaming Events
export interface ClaudeStreamEvent {
  type: 'message_start' | 'content_block_start' | 'content_block_delta' | 'content_block_stop' | 'message_delta' | 'message_stop' | 'ping' | 'error'
  index?: number
  message?: Partial<ClaudeMessageResponse>
  content_block?: ClaudeContentBlock
  delta?: {
    type: 'text_delta' | 'input_json_delta'
    text?: string
    partial_json?: string
    stop_reason?: string
    stop_sequence?: string | null
  }
  usage?: {
    output_tokens: number
  }
  error?: {
    type: string
    message: string
  }
}
