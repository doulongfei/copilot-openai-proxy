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

// ==================== OpenAI API Types ====================

// Message Content Parts
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

export type ContentPart = TextPart | ImageUrlPart

export type MessageContent = string | Array<ContentPart> | null

// Tool Definitions
export interface OpenAITool {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters?: Record<string, unknown>
  }
}

// Tool Call (in response)
export interface OpenAIToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

// Tool Call Delta (in streaming response)
export interface OpenAIToolCallDelta {
  index: number
  id?: string
  type?: 'function'
  function?: {
    name?: string
    arguments?: string
  }
}

// Tool Choice
export type OpenAIToolChoice =
  | 'none'
  | 'auto'
  | 'required'
  | { type: 'function'; function: { name: string } }

// Response Format
export type OpenAIResponseFormat =
  | { type: 'text' }
  | { type: 'json_object' }
  | { type: 'json_schema'; json_schema: { name: string; strict?: boolean; schema: Record<string, unknown> } }

// Stream Options
export interface OpenAIStreamOptions {
  include_usage?: boolean
}

// Messages with all role types
export interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool' | 'developer'
  content: MessageContent
  name?: string
  tool_calls?: OpenAIToolCall[]
  tool_call_id?: string
}

// Chat Completion Request
export interface OpenAIChatCompletionRequest {
  model: string
  messages: OpenAIChatMessage[]
  temperature?: number | null
  top_p?: number | null
  n?: number | null
  stream?: boolean | null
  stream_options?: OpenAIStreamOptions | null
  stop?: string | string[] | null
  max_tokens?: number | null
  max_completion_tokens?: number | null
  presence_penalty?: number | null
  frequency_penalty?: number | null
  logit_bias?: Record<string, number> | null
  logprobs?: boolean | null
  top_logprobs?: number | null
  response_format?: OpenAIResponseFormat | null
  seed?: number | null
  tools?: OpenAITool[] | null
  tool_choice?: OpenAIToolChoice | null
  parallel_tool_calls?: boolean | null
  user?: string | null
  store?: boolean | null
  service_tier?: 'auto' | 'default' | null
}

// Chat Completion Response (non-streaming)
export interface OpenAIChatCompletionResponse {
  id: string
  object: 'chat.completion'
  created: number
  model: string
  choices: {
    index: number
    message: {
      role: 'assistant'
      content: string | null
      tool_calls?: OpenAIToolCall[]
      refusal?: string | null
    }
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null
    logprobs?: unknown | null
  }[]
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    prompt_tokens_details?: {
      cached_tokens?: number
    }
    completion_tokens_details?: {
      reasoning_tokens?: number
    }
  }
  system_fingerprint?: string
  service_tier?: string
}

// Chat Completion Chunk (streaming)
export interface OpenAIChatCompletionChunk {
  id: string
  object: 'chat.completion.chunk'
  created: number
  model: string
  choices: {
    index: number
    delta: {
      role?: 'assistant'
      content?: string | null
      tool_calls?: OpenAIToolCallDelta[]
    }
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null
    logprobs?: unknown | null
  }[]
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    prompt_tokens_details?: {
      cached_tokens?: number
    }
  } | null
  system_fingerprint?: string
}

// Model Types
export interface OpenAIModelResponse {
  id: string
  object: string
  created: number
  owned_by: string
}

// Model Capabilities (Copilot API response)
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
  input: Record<string, unknown>
}

export interface ClaudeToolResultContent {
  type: 'tool_result'
  tool_use_id: string
  content?: string | Array<ClaudeTextContent | ClaudeImageContent>
  is_error?: boolean
}

export interface ClaudeThinkingContent {
  type: 'thinking'
  thinking: string
}

export type ClaudeContentBlock =
  | ClaudeTextContent
  | ClaudeImageContent
  | ClaudeToolUseContent
  | ClaudeToolResultContent
  | ClaudeThinkingContent

export type ClaudeUserContentBlock =
  | ClaudeTextContent
  | ClaudeImageContent
  | ClaudeToolResultContent

export type ClaudeAssistantContentBlock =
  | ClaudeTextContent
  | ClaudeToolUseContent
  | ClaudeThinkingContent

// Claude Message Types
export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string | ClaudeContentBlock[]
}

// Claude Tool Definition
export interface ClaudeTool {
  name: string
  description?: string
  input_schema: Record<string, unknown>
}

// Claude Tool Choice
export type ClaudeToolChoice =
  | { type: 'auto' }
  | { type: 'any' }
  | { type: 'none' }
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
  thinking?: {
    type: 'enabled'
    budget_tokens?: number
  }
  service_tier?: 'auto' | 'standard_only'
}

// Claude Response
export interface ClaudeMessageResponse {
  id: string
  type: 'message'
  role: 'assistant'
  content: ClaudeAssistantContentBlock[]
  model: string
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | 'pause_turn' | 'refusal' | null
  stop_sequence: string | null
  usage: {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
    service_tier?: 'standard' | 'priority' | 'batch'
  }
}

// Claude Streaming State
export interface ClaudeStreamState {
  messageStartSent: boolean
  contentBlockIndex: number
  contentBlockOpen: boolean
  toolCalls: Record<number, {
    id: string
    name: string
    anthropicBlockIndex: number
  }>
}

// Claude Streaming Events
export type ClaudeStreamEventType =
  | 'message_start'
  | 'content_block_start'
  | 'content_block_delta'
  | 'content_block_stop'
  | 'message_delta'
  | 'message_stop'
  | 'ping'
  | 'error'

export interface ClaudeMessageStartEvent {
  type: 'message_start'
  message: ClaudeMessageResponse
}

export interface ClaudeContentBlockStartEvent {
  type: 'content_block_start'
  index: number
  content_block: ClaudeTextContent | ClaudeToolUseContent
}

export interface ClaudeContentBlockDeltaEvent {
  type: 'content_block_delta'
  index: number
  delta: {
    type: 'text_delta'
    text: string
  } | {
    type: 'input_json_delta'
    partial_json: string
  }
}

export interface ClaudeContentBlockStopEvent {
  type: 'content_block_stop'
  index: number
}

export interface ClaudeMessageDeltaEvent {
  type: 'message_delta'
  delta: {
    stop_reason: ClaudeMessageResponse['stop_reason']
    stop_sequence: string | null
  }
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

export interface ClaudeMessageStopEvent {
  type: 'message_stop'
}

export interface ClaudePingEvent {
  type: 'ping'
}

export interface ClaudeErrorEvent {
  type: 'error'
  error: {
    type: string
    message: string
  }
}

export type ClaudeStreamEvent =
  | ClaudeMessageStartEvent
  | ClaudeContentBlockStartEvent
  | ClaudeContentBlockDeltaEvent
  | ClaudeContentBlockStopEvent
  | ClaudeMessageDeltaEvent
  | ClaudeMessageStopEvent
  | ClaudePingEvent
  | ClaudeErrorEvent
