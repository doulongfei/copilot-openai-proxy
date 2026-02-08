import {FormatConverter} from '../src/converter'
import {
    ClaudeMessageRequest,
    ClaudeMessage,
    OpenAIChatCompletionResponse,
    OpenAIChatCompletionChunk,
    ClaudeStreamState,
} from '../src/types'

describe('FormatConverter', () => {

    // ==================== Model Mapping ====================

    describe('mapModelName', () => {
        it('should map Claude 3 official names to Copilot names', () => {
            expect(FormatConverter.mapModelName('claude-3-opus-20240229')).toBe('claude-opus-41')
            expect(FormatConverter.mapModelName('claude-3-5-sonnet-20241022')).toBe('claude-sonnet-4.5')
            expect(FormatConverter.mapModelName('claude-3-haiku-20240307')).toBe('claude-haiku-4.5')
            expect(FormatConverter.mapModelName('claude-3-sonnet-20240229')).toBe('claude-sonnet-4')
        })

        it('should map Claude 4 series with dates', () => {
            expect(FormatConverter.mapModelName('claude-sonnet-4-20250514')).toBe('claude-sonnet-4')
            expect(FormatConverter.mapModelName('claude-sonnet-4.5-20250514')).toBe('claude-sonnet-4.5')
        })

        it('should pass through already-supported names', () => {
            expect(FormatConverter.mapModelName('claude-opus-41')).toBe('claude-opus-41')
            expect(FormatConverter.mapModelName('claude-sonnet-4.5')).toBe('claude-sonnet-4.5')
            expect(FormatConverter.mapModelName('claude-sonnet-4')).toBe('claude-sonnet-4')
        })

        it('should handle dash variants', () => {
            expect(FormatConverter.mapModelName('claude-haiku-4-5')).toBe('claude-haiku-4.5')
            expect(FormatConverter.mapModelName('claude-sonnet-4-5')).toBe('claude-sonnet-4.5')
            expect(FormatConverter.mapModelName('claude-opus-4-1')).toBe('claude-opus-41')
        })

        it('should strip date suffix and retry', () => {
            expect(FormatConverter.mapModelName('claude-haiku-4-5-20251001')).toBe('claude-haiku-4.5')
        })

        it('should fuzzy match claude-3 prefixes', () => {
            expect(FormatConverter.mapModelName('claude-3-opus-latest')).toBe('claude-opus-41')
            expect(FormatConverter.mapModelName('claude-3-5-sonnet-latest')).toBe('claude-sonnet-4.5')
            expect(FormatConverter.mapModelName('claude-3.5-sonnet-v2')).toBe('claude-sonnet-4.5')
        })

        it('should return original name for unknown models', () => {
            expect(FormatConverter.mapModelName('gpt-4o')).toBe('gpt-4o')
            expect(FormatConverter.mapModelName('some-unknown-model')).toBe('some-unknown-model')
        })

        it('should map GPT aliases', () => {
            expect(FormatConverter.mapModelName('gpt-4-turbo')).toBe('gpt-4')
            expect(FormatConverter.mapModelName('gpt-4-turbo-preview')).toBe('gpt-4')
        })
    })

    // ==================== Claude → OpenAI ====================

    describe('claudeToOpenAI', () => {
        it('should convert basic text message', () => {
            const req: ClaudeMessageRequest = {
                model: 'claude-3-5-sonnet-20241022',
                messages: [{role: 'user', content: 'Hello'}],
                max_tokens: 1024,
            }

            const result = FormatConverter.claudeToOpenAI(req)

            expect(result.model).toBe('claude-sonnet-4.5')
            expect(result.max_tokens).toBe(1024)
            expect(result.messages).toHaveLength(1)
            expect(result.messages[0]).toEqual({role: 'user', content: 'Hello'})
        })

        it('should convert system prompt (string)', () => {
            const req: ClaudeMessageRequest = {
                model: 'claude-sonnet-4',
                messages: [{role: 'user', content: 'Hi'}],
                max_tokens: 100,
                system: 'You are a helpful assistant.',
            }

            const result = FormatConverter.claudeToOpenAI(req)

            expect(result.messages).toHaveLength(2)
            expect(result.messages[0]).toEqual({role: 'system', content: 'You are a helpful assistant.'})
            expect(result.messages[1]).toEqual({role: 'user', content: 'Hi'})
        })

        it('should convert system prompt (array)', () => {
            const req: ClaudeMessageRequest = {
                model: 'claude-sonnet-4',
                messages: [{role: 'user', content: 'Hi'}],
                max_tokens: 100,
                system: [
                    {type: 'text', text: 'Part 1'},
                    {type: 'text', text: 'Part 2'},
                ],
            }

            const result = FormatConverter.claudeToOpenAI(req)

            expect(result.messages[0]).toEqual({role: 'system', content: 'Part 1\n\nPart 2'})
        })

        it('should convert optional parameters', () => {
            const req: ClaudeMessageRequest = {
                model: 'claude-sonnet-4',
                messages: [{role: 'user', content: 'Hi'}],
                max_tokens: 100,
                temperature: 0.7,
                top_p: 0.9,
                stop_sequences: ['END'],
                metadata: {user_id: 'user-123'},
            }

            const result = FormatConverter.claudeToOpenAI(req)

            expect(result.temperature).toBe(0.7)
            expect(result.top_p).toBe(0.9)
            expect(result.stop).toEqual(['END'])
            expect(result.user).toBe('user-123')
        })

        it('should convert tools and tool_choice', () => {
            const req: ClaudeMessageRequest = {
                model: 'claude-sonnet-4',
                messages: [{role: 'user', content: 'What is the weather?'}],
                max_tokens: 1024,
                tools: [
                    {
                        name: 'get_weather',
                        description: 'Get weather info',
                        input_schema: {
                            type: 'object',
                            properties: {location: {type: 'string'}},
                            required: ['location'],
                        },
                    },
                ],
                tool_choice: {type: 'auto'},
            }

            const result = FormatConverter.claudeToOpenAI(req)

            expect(result.tools).toHaveLength(1)
            expect(result.tools![0]).toEqual({
                type: 'function',
                function: {
                    name: 'get_weather',
                    description: 'Get weather info',
                    parameters: {
                        type: 'object',
                        properties: {location: {type: 'string'}},
                        required: ['location'],
                    },
                },
            })
            expect(result.tool_choice).toBe('auto')
        })

        it('should convert tool_choice "any" to "required"', () => {
            const req: ClaudeMessageRequest = {
                model: 'claude-sonnet-4',
                messages: [{role: 'user', content: 'Hi'}],
                max_tokens: 100,
                tools: [{name: 'test', input_schema: {type: 'object', properties: {}}}],
                tool_choice: {type: 'any'},
            }

            const result = FormatConverter.claudeToOpenAI(req)
            expect(result.tool_choice).toBe('required')
        })

        it('should convert tool_choice "tool" to function spec', () => {
            const req: ClaudeMessageRequest = {
                model: 'claude-sonnet-4',
                messages: [{role: 'user', content: 'Hi'}],
                max_tokens: 100,
                tools: [{name: 'test', input_schema: {type: 'object', properties: {}}}],
                tool_choice: {type: 'tool', name: 'test'},
            }

            const result = FormatConverter.claudeToOpenAI(req)
            expect(result.tool_choice).toEqual({type: 'function', function: {name: 'test'}})
        })

        it('should convert tool_choice "none"', () => {
            const req: ClaudeMessageRequest = {
                model: 'claude-sonnet-4',
                messages: [{role: 'user', content: 'Hi'}],
                max_tokens: 100,
                tool_choice: {type: 'none'},
            }

            const result = FormatConverter.claudeToOpenAI(req)
            expect(result.tool_choice).toBe('none')
        })

        it('should convert assistant message with tool_use to tool_calls', () => {
            const req: ClaudeMessageRequest = {
                model: 'claude-sonnet-4',
                messages: [
                    {role: 'user', content: 'What is the weather?'},
                    {
                        role: 'assistant',
                        content: [
                            {type: 'text', text: 'Let me check.'},
                            {
                                type: 'tool_use',
                                id: 'tool_abc123',
                                name: 'get_weather',
                                input: {location: 'Tokyo'},
                            },
                        ],
                    },
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'tool_result',
                                tool_use_id: 'tool_abc123',
                                content: 'Sunny, 25°C',
                            },
                        ],
                    },
                ],
                max_tokens: 1024,
            }

            const result = FormatConverter.claudeToOpenAI(req)

            // System messages: none. User + assistant with tool_calls + tool result + (no extra user)
            // assistant message should have tool_calls
            const assistantMsg = result.messages.find(m => m.role === 'assistant')
            expect(assistantMsg).toBeDefined()
            expect(assistantMsg!.tool_calls).toHaveLength(1)
            expect(assistantMsg!.tool_calls![0].id).toBe('tool_abc123')
            expect(assistantMsg!.tool_calls![0].function.name).toBe('get_weather')
            expect(JSON.parse(assistantMsg!.tool_calls![0].function.arguments)).toEqual({location: 'Tokyo'})

            // tool result should become a "tool" role message
            const toolMsg = result.messages.find(m => m.role === 'tool')
            expect(toolMsg).toBeDefined()
            expect(toolMsg!.tool_call_id).toBe('tool_abc123')
            expect(toolMsg!.content).toBe('Sunny, 25°C')
        })

        it('should convert image content', () => {
            const req: ClaudeMessageRequest = {
                model: 'claude-sonnet-4',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {type: 'text', text: 'What is this?'},
                            {
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: 'image/png',
                                    data: 'iVBORw0KGgo...',
                                },
                            },
                        ],
                    },
                ],
                max_tokens: 1024,
            }

            const result = FormatConverter.claudeToOpenAI(req)

            expect(result.messages).toHaveLength(1)
            const msg = result.messages[0]
            expect(Array.isArray(msg.content)).toBe(true)
            const parts = msg.content as any[]
            expect(parts).toHaveLength(2)
            expect(parts[0]).toEqual({type: 'text', text: 'What is this?'})
            expect(parts[1].type).toBe('image_url')
            expect(parts[1].image_url.url).toBe('data:image/png;base64,iVBORw0KGgo...')
        })
    })

    // ==================== OpenAI → Claude (Non-Streaming) ====================

    describe('openAIToClaude', () => {
        it('should convert basic text response', () => {
            const resp: OpenAIChatCompletionResponse = {
                id: 'chatcmpl-123',
                object: 'chat.completion',
                created: 1234567890,
                model: 'gpt-4o',
                choices: [{
                    index: 0,
                    message: {role: 'assistant', content: 'Hello!'},
                    finish_reason: 'stop',
                }],
                usage: {prompt_tokens: 10, completion_tokens: 5, total_tokens: 15},
            }

            const result = FormatConverter.openAIToClaude(resp, 'claude-sonnet-4')

            expect(result.id).toBe('chatcmpl-123')
            expect(result.type).toBe('message')
            expect(result.role).toBe('assistant')
            expect(result.model).toBe('claude-sonnet-4')
            expect(result.stop_reason).toBe('end_turn')
            expect(result.content).toHaveLength(1)
            expect(result.content[0]).toEqual({type: 'text', text: 'Hello!'})
            expect(result.usage).toEqual({input_tokens: 10, output_tokens: 5})
        })

        it('should convert tool_calls response', () => {
            const resp: OpenAIChatCompletionResponse = {
                id: 'chatcmpl-456',
                object: 'chat.completion',
                created: 1234567890,
                model: 'gpt-4o',
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: null,
                        tool_calls: [{
                            id: 'call_abc',
                            type: 'function',
                            function: {
                                name: 'get_weather',
                                arguments: '{"location":"Tokyo"}',
                            },
                        }],
                    },
                    finish_reason: 'tool_calls',
                }],
                usage: {prompt_tokens: 20, completion_tokens: 10, total_tokens: 30},
            }

            const result = FormatConverter.openAIToClaude(resp, 'claude-sonnet-4')

            expect(result.stop_reason).toBe('tool_use')
            expect(result.content).toHaveLength(1)
            expect(result.content[0].type).toBe('tool_use')
            const toolUse = result.content[0] as any
            expect(toolUse.id).toBe('call_abc')
            expect(toolUse.name).toBe('get_weather')
            expect(toolUse.input).toEqual({location: 'Tokyo'})
        })

        it('should convert response with both text and tool_calls', () => {
            const resp: OpenAIChatCompletionResponse = {
                id: 'chatcmpl-789',
                object: 'chat.completion',
                created: 1234567890,
                model: 'gpt-4o',
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: 'Let me check.',
                        tool_calls: [{
                            id: 'call_xyz',
                            type: 'function',
                            function: {
                                name: 'search',
                                arguments: '{"query":"test"}',
                            },
                        }],
                    },
                    finish_reason: 'tool_calls',
                }],
                usage: {prompt_tokens: 15, completion_tokens: 8, total_tokens: 23},
            }

            const result = FormatConverter.openAIToClaude(resp, 'claude-sonnet-4')

            expect(result.content).toHaveLength(2)
            expect(result.content[0]).toEqual({type: 'text', text: 'Let me check.'})
            expect(result.content[1].type).toBe('tool_use')
        })

        it('should handle empty content with fallback', () => {
            const resp: OpenAIChatCompletionResponse = {
                id: 'chatcmpl-empty',
                object: 'chat.completion',
                created: 1234567890,
                model: 'gpt-4o',
                choices: [{
                    index: 0,
                    message: {role: 'assistant', content: null},
                    finish_reason: 'stop',
                }],
            }

            const result = FormatConverter.openAIToClaude(resp, 'claude-sonnet-4')

            expect(result.content).toHaveLength(1)
            expect(result.content[0]).toEqual({type: 'text', text: ''})
        })

        it('should map finish_reason correctly', () => {
            const makeResp = (reason: string): OpenAIChatCompletionResponse => ({
                id: 'test',
                object: 'chat.completion',
                created: 0,
                model: 'gpt-4o',
                choices: [{index: 0, message: {role: 'assistant', content: 'x'}, finish_reason: reason as any}],
            })

            expect(FormatConverter.openAIToClaude(makeResp('stop'), 'm').stop_reason).toBe('end_turn')
            expect(FormatConverter.openAIToClaude(makeResp('length'), 'm').stop_reason).toBe('max_tokens')
            expect(FormatConverter.openAIToClaude(makeResp('tool_calls'), 'm').stop_reason).toBe('tool_use')
            expect(FormatConverter.openAIToClaude(makeResp('content_filter'), 'm').stop_reason).toBe('end_turn')
        })

        it('should include cached_tokens in usage', () => {
            const resp: OpenAIChatCompletionResponse = {
                id: 'test',
                object: 'chat.completion',
                created: 0,
                model: 'gpt-4o',
                choices: [{index: 0, message: {role: 'assistant', content: 'hi'}, finish_reason: 'stop'}],
                usage: {
                    prompt_tokens: 100,
                    completion_tokens: 10,
                    total_tokens: 110,
                    prompt_tokens_details: {cached_tokens: 50},
                },
            }

            const result = FormatConverter.openAIToClaude(resp, 'claude-sonnet-4')

            expect(result.usage.input_tokens).toBe(100)
            expect(result.usage.output_tokens).toBe(10)
            expect(result.usage.cache_read_input_tokens).toBe(50)
        })
    })

    // ==================== Streaming ====================

    describe('translateChunkToClaudeEvents', () => {
        it('should emit message_start on first chunk', () => {
            const state = FormatConverter.createStreamState()
            const chunk: OpenAIChatCompletionChunk = {
                id: 'chatcmpl-stream1',
                object: 'chat.completion.chunk',
                created: 1234567890,
                model: 'gpt-4o',
                choices: [{
                    index: 0,
                    delta: {role: 'assistant', content: 'Hi'},
                    finish_reason: null,
                }],
            }

            const events = FormatConverter.translateChunkToClaudeEvents(chunk, state, 'claude-sonnet-4')

            expect(events.length).toBeGreaterThanOrEqual(3) // message_start + content_block_start + delta
            expect(events[0].type).toBe('message_start')
            expect(events[1].type).toBe('content_block_start')
            expect(events[2].type).toBe('content_block_delta')
            expect(state.messageStartSent).toBe(true)
        })

        it('should emit text deltas', () => {
            const state = FormatConverter.createStreamState()
            state.messageStartSent = true
            state.contentBlockOpen = true

            const chunk: OpenAIChatCompletionChunk = {
                id: 'test',
                object: 'chat.completion.chunk',
                created: 0,
                model: 'gpt-4o',
                choices: [{index: 0, delta: {content: 'world'}, finish_reason: null}],
            }

            const events = FormatConverter.translateChunkToClaudeEvents(chunk, state, 'claude-sonnet-4')

            expect(events).toHaveLength(1)
            expect(events[0].type).toBe('content_block_delta')
            expect((events[0] as any).delta.type).toBe('text_delta')
            expect((events[0] as any).delta.text).toBe('world')
        })

        it('should handle tool_calls in streaming', () => {
            const state = FormatConverter.createStreamState()
            state.messageStartSent = true

            const chunk: OpenAIChatCompletionChunk = {
                id: 'test',
                object: 'chat.completion.chunk',
                created: 0,
                model: 'gpt-4o',
                choices: [{
                    index: 0,
                    delta: {
                        tool_calls: [{
                            index: 0,
                            id: 'call_123',
                            type: 'function',
                            function: {name: 'get_weather', arguments: ''},
                        }],
                    },
                    finish_reason: null,
                }],
            }

            const events = FormatConverter.translateChunkToClaudeEvents(chunk, state, 'claude-sonnet-4')

            const startEvent = events.find(e => e.type === 'content_block_start')
            expect(startEvent).toBeDefined()
            expect((startEvent as any).content_block.type).toBe('tool_use')
            expect((startEvent as any).content_block.id).toBe('call_123')
            expect((startEvent as any).content_block.name).toBe('get_weather')
        })

        it('should accumulate tool_call arguments', () => {
            const state = FormatConverter.createStreamState()
            state.messageStartSent = true
            state.contentBlockOpen = true
            state.toolCalls = {0: {id: 'call_123', name: 'get_weather', anthropicBlockIndex: 0}}

            const chunk: OpenAIChatCompletionChunk = {
                id: 'test',
                object: 'chat.completion.chunk',
                created: 0,
                model: 'gpt-4o',
                choices: [{
                    index: 0,
                    delta: {
                        tool_calls: [{
                            index: 0,
                            function: {arguments: '{"loc'},
                        }],
                    },
                    finish_reason: null,
                }],
            }

            const events = FormatConverter.translateChunkToClaudeEvents(chunk, state, 'claude-sonnet-4')

            expect(events).toHaveLength(1)
            expect(events[0].type).toBe('content_block_delta')
            expect((events[0] as any).delta.type).toBe('input_json_delta')
            expect((events[0] as any).delta.partial_json).toBe('{"loc')
        })

        it('should handle finish_reason', () => {
            const state = FormatConverter.createStreamState()
            state.messageStartSent = true
            state.contentBlockOpen = true

            const chunk: OpenAIChatCompletionChunk = {
                id: 'test',
                object: 'chat.completion.chunk',
                created: 0,
                model: 'gpt-4o',
                choices: [{index: 0, delta: {}, finish_reason: 'stop'}],
            }

            const events = FormatConverter.translateChunkToClaudeEvents(chunk, state, 'claude-sonnet-4')

            const types = events.map(e => e.type)
            expect(types).toContain('content_block_stop')
            expect(types).toContain('message_delta')
            expect(types).toContain('message_stop')

            const deltaEvent = events.find(e => e.type === 'message_delta') as any
            expect(deltaEvent.delta.stop_reason).toBe('end_turn')
        })
    })

    // ==================== Serialization ====================

    describe('serializeClaudeEvents', () => {
        it('should serialize events to SSE format', () => {
            const events = [
                {type: 'content_block_delta' as const, index: 0, delta: {type: 'text_delta' as const, text: 'Hi'}},
            ]

            const result = FormatConverter.serializeClaudeEvents(events)

            expect(result).toContain('event: content_block_delta')
            expect(result).toContain('data: ')
            expect(result).toContain('"text":"Hi"')
        })
    })

    // ==================== Validation ====================

    describe('validateClaudeRequest', () => {
        it('should pass valid request', () => {
            const result = FormatConverter.validateClaudeRequest({
                model: 'claude-sonnet-4',
                messages: [{role: 'user', content: 'Hi'}],
                max_tokens: 1024,
            })
            expect(result.valid).toBe(true)
        })

        it('should fail without model', () => {
            const result = FormatConverter.validateClaudeRequest({
                messages: [{role: 'user', content: 'Hi'}],
                max_tokens: 1024,
            })
            expect(result.valid).toBe(false)
            expect(result.error).toContain('model')
        })

        it('should fail without messages', () => {
            const result = FormatConverter.validateClaudeRequest({
                model: 'claude-sonnet-4',
                max_tokens: 1024,
            })
            expect(result.valid).toBe(false)
            expect(result.error).toContain('messages')
        })

        it('should fail with empty messages', () => {
            const result = FormatConverter.validateClaudeRequest({
                model: 'claude-sonnet-4',
                messages: [],
                max_tokens: 1024,
            })
            expect(result.valid).toBe(false)
        })

        it('should fail without max_tokens', () => {
            const result = FormatConverter.validateClaudeRequest({
                model: 'claude-sonnet-4',
                messages: [{role: 'user', content: 'Hi'}],
            })
            expect(result.valid).toBe(false)
            expect(result.error).toContain('max_tokens')
        })

        it('should fail with invalid max_tokens', () => {
            const result = FormatConverter.validateClaudeRequest({
                model: 'claude-sonnet-4',
                messages: [{role: 'user', content: 'Hi'}],
                max_tokens: -1,
            })
            expect(result.valid).toBe(false)
        })

        it('should fail with invalid role', () => {
            const result = FormatConverter.validateClaudeRequest({
                model: 'claude-sonnet-4',
                messages: [{role: 'system', content: 'Hi'}],
                max_tokens: 1024,
            })
            expect(result.valid).toBe(false)
            expect(result.error).toContain('role')
        })
    })

    // ==================== Error ====================

    describe('createClaudeError', () => {
        it('should create error with correct format', () => {
            const error = FormatConverter.createClaudeError('invalid_request_error', 'Bad request', 400)

            expect(error.statusCode).toBe(400)
            expect(error.body.type).toBe('error')
            expect(error.body.error.type).toBe('invalid_request_error')
            expect(error.body.error.message).toBe('Bad request')
        })

        it('should default to 400 status', () => {
            const error = FormatConverter.createClaudeError('test', 'msg')
            expect(error.statusCode).toBe(400)
        })
    })
})
