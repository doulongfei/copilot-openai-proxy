import {
    ClaudeMessageRequest,
    ClaudeMessageResponse,
    ClaudeMessage,
    ClaudeTextContent,
    ClaudeImageContent,
    ClaudeToolUseContent,
    ClaudeToolResultContent,
    ClaudeThinkingContent,
    ClaudeAssistantContentBlock,
    ClaudeTool,
    ClaudeStreamState,
    ClaudeStreamEvent,
    OpenAIChatCompletionRequest,
    OpenAIChatCompletionResponse,
    OpenAIChatCompletionChunk,
    OpenAIChatMessage,
    OpenAITool,
    MessageContent,
    ContentPart,
    TextPart,
} from './types'

/**
 * Bidirectional format converter between Claude API and OpenAI API
 */
export class FormatConverter {
    /**
     * Model name mapping: Claude official names → Copilot names
     */
    private static readonly MODEL_MAPPING: Record<string, string> = {
        // Claude 3 series
        'claude-3-opus-20240229': 'claude-opus-41',
        'claude-3-5-sonnet-20241022': 'claude-sonnet-4.5',
        'claude-3-5-sonnet-20240620': 'claude-sonnet-4.5',
        'claude-3-sonnet-20240229': 'claude-sonnet-4',
        'claude-3-haiku-20240307': 'claude-haiku-4.5',
        'claude-3-5-haiku-20241022': 'claude-haiku-4.5',

        // Claude 4 series with dates
        'claude-sonnet-4-20250514': 'claude-sonnet-4',
        'claude-sonnet-4.5-20250514': 'claude-sonnet-4.5',

        // Common aliases
        'claude-3-opus': 'claude-opus-41',
        'claude-3-sonnet': 'claude-sonnet-4',
        'claude-3-haiku': 'claude-haiku-4.5',
        'claude-3.5-sonnet': 'claude-sonnet-4.5',
        'claude-3.5-haiku': 'claude-haiku-4.5',

        // Already supported formats
        'claude-opus-41': 'claude-opus-41',
        'claude-sonnet-4.5': 'claude-sonnet-4.5',
        'claude-sonnet-4': 'claude-sonnet-4',
        'claude-haiku-4.5': 'claude-haiku-4.5',

        // Dash variants
        'claude-haiku-4-5': 'claude-haiku-4.5',
        'claude-sonnet-4-5': 'claude-sonnet-4.5',
        'claude-opus-4-1': 'claude-opus-41',

        // GPT aliases
        'gpt-4-turbo': 'gpt-4',
        'gpt-4-turbo-preview': 'gpt-4',
    }

    /**
     * Map model name from Claude format to Copilot format
     */
    static mapModelName(model: string): string {
        const mapped = this.MODEL_MAPPING[model]
        if (mapped) {
            if (mapped !== model) console.log(`[Model Mapping] ${model} -> ${mapped}`)
            return mapped
        }

        // Strip date suffix and retry (e.g. claude-sonnet-4-20250514)
        const withoutDate = model.replace(/-\d{8}$/, '')
        if (withoutDate !== model) {
            const result = this.mapModelName(withoutDate)
            if (result !== withoutDate) {
                console.log(`[Model Mapping] ${model} -> ${result} (date stripped)`)
                return result
            }
        }

        // Fuzzy matching
        if (model.startsWith('claude-3-opus')) return 'claude-opus-41'
        if (model.startsWith('claude-3-5-sonnet') || model.startsWith('claude-3.5-sonnet')) return 'claude-sonnet-4.5'
        if (model.startsWith('claude-3-sonnet')) return 'claude-sonnet-4'
        if (model.startsWith('claude-3-haiku') || model.startsWith('claude-3-5-haiku') || model.startsWith('claude-3.5-haiku')) return 'claude-haiku-4.5'
        if (model.startsWith('claude-haiku-4-5')) return 'claude-haiku-4.5'
        if (model.startsWith('claude-sonnet-4-5')) return 'claude-sonnet-4.5'
        if (model.startsWith('claude-opus-4-1')) return 'claude-opus-41'
        if (model.startsWith('claude-sonnet-4')) return 'claude-sonnet-4'
        if (model.startsWith('claude-opus-4')) return 'claude-opus-41'

        console.warn(`[Model Mapping] No mapping found for: ${model}, using original`)
        return model
    }

    // ==================== Claude → OpenAI ====================

    /**
     * Convert Claude request to OpenAI format
     */
    static claudeToOpenAI(claudeReq: ClaudeMessageRequest): OpenAIChatCompletionRequest {
        const mappedModel = this.mapModelName(claudeReq.model)
        const messages = this.translateMessages(claudeReq.messages, claudeReq.system)

        const req: OpenAIChatCompletionRequest = {
            model: mappedModel,
            messages,
            max_tokens: claudeReq.max_tokens,
            stream: claudeReq.stream || false
        }

        if (claudeReq.temperature !== undefined) req.temperature = claudeReq.temperature
        if (claudeReq.top_p !== undefined) req.top_p = claudeReq.top_p
        if (claudeReq.stop_sequences) req.stop = claudeReq.stop_sequences
        if (claudeReq.metadata?.user_id) req.user = claudeReq.metadata.user_id

        // Convert tools
        if (claudeReq.tools) {
            req.tools = this.translateClaudeToolsToOpenAI(claudeReq.tools)
        }

        // Convert tool_choice
        if (claudeReq.tool_choice) {
            req.tool_choice = this.translateClaudeToolChoiceToOpenAI(claudeReq.tool_choice)
        }

        return req
    }

    /**
     * Translate Claude tools to OpenAI format
     */
    private static translateClaudeToolsToOpenAI(tools: ClaudeTool[]): OpenAITool[] {
        return tools.map(tool => ({
            type: 'function' as const,
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.input_schema,
            }
        }))
    }

    /**
     * Translate Claude tool_choice to OpenAI format
     */
    private static translateClaudeToolChoiceToOpenAI(
        choice: ClaudeMessageRequest['tool_choice']
    ): OpenAIChatCompletionRequest['tool_choice'] {
        if (!choice) return undefined

        switch (choice.type) {
            case 'auto': return 'auto'
            case 'any': return 'required'
            case 'none': return 'none'
            case 'tool':
                if ('name' in choice && choice.name) {
                    return { type: 'function', function: { name: choice.name } }
                }
                return undefined
            default: return undefined
        }
    }

    /**
     * Translate Claude messages array to OpenAI format, handling system prompt
     */
    private static translateMessages(
        messages: ClaudeMessage[],
        system?: ClaudeMessageRequest['system']
    ): OpenAIChatMessage[] {
        const result: OpenAIChatMessage[] = []

        // System prompt
        if (system) {
            const text = typeof system === 'string'
                ? system
                : system.map(b => b.text).join('\n\n')
            result.push({ role: 'system', content: text })
        }

        // Convert each message
        for (const msg of messages) {
            if (msg.role === 'user') {
                result.push(...this.handleUserMessage(msg))
            } else {
                result.push(...this.handleAssistantMessage(msg))
            }
        }

        return result
    }

    /**
     * Handle user message: extract tool_results as separate "tool" role messages
     */
    private static handleUserMessage(msg: ClaudeMessage): OpenAIChatMessage[] {
        if (typeof msg.content === 'string') {
            return [{ role: 'user', content: msg.content }]
        }

        const result: OpenAIChatMessage[] = []
        const contentParts: ContentPart[] = []

        for (const block of msg.content) {
            if (block.type === 'tool_result') {
                const toolResult = block as ClaudeToolResultContent
                const text = typeof toolResult.content === 'string'
                    ? toolResult.content
                    : toolResult.content
                        ? toolResult.content
                            .filter((b): b is ClaudeTextContent => b.type === 'text')
                            .map(b => b.text)
                            .join('\n')
                        : ''
                // Tool results become "tool" role messages in OpenAI format
                result.push({
                    role: 'tool',
                    tool_call_id: toolResult.tool_use_id,
                    content: text
                })
            } else if (block.type === 'text') {
                contentParts.push({ type: 'text', text: (block as ClaudeTextContent).text })
            } else if (block.type === 'image') {
                const img = block as ClaudeImageContent
                const url = img.source.type === 'base64'
                    ? `data:${img.source.media_type};base64,${img.source.data}`
                    : img.source.url!
                contentParts.push({ type: 'image_url', image_url: { url } })
            }
        }

        // Tool results go first, then remaining user content
        if (contentParts.length > 0) {
            const content: MessageContent = contentParts.length === 1 && contentParts[0].type === 'text'
                ? (contentParts[0] as TextPart).text
                : contentParts
            result.push({ role: 'user', content })
        }

        return result
    }

    /**
     * Handle assistant message: extract tool_use as tool_calls on the assistant message
     */
    private static handleAssistantMessage(msg: ClaudeMessage): OpenAIChatMessage[] {
        if (typeof msg.content === 'string') {
            return [{ role: 'assistant', content: msg.content }]
        }

        const toolUseBlocks = msg.content.filter(
            (b): b is ClaudeToolUseContent => b.type === 'tool_use'
        )

        // Extract text content (including thinking blocks)
        const textParts = msg.content
            .filter((b): b is ClaudeTextContent | ClaudeThinkingContent =>
                b.type === 'text' || b.type === 'thinking'
            )
            .map(b => b.type === 'text' ? (b as ClaudeTextContent).text : (b as ClaudeThinkingContent).thinking)

        const textContent = textParts.join('\n') || null

        if (toolUseBlocks.length > 0) {
            // Assistant message with tool_calls
            return [{
                role: 'assistant',
                content: textContent,
                tool_calls: toolUseBlocks.map(tu => ({
                    id: tu.id,
                    type: 'function' as const,
                    function: {
                        name: tu.name,
                        arguments: JSON.stringify(tu.input),
                    }
                }))
            }]
        }

        return [{ role: 'assistant', content: textContent }]
    }

    // ==================== OpenAI → Claude (Non-Streaming) ====================

    /**
     * Convert OpenAI response to Claude format
     */
    static openAIToClaude(
        resp: OpenAIChatCompletionResponse,
        originalModel: string
    ): ClaudeMessageResponse {
        const choice = resp.choices[0]
        const content: ClaudeAssistantContentBlock[] = []

        // Text content
        if (choice.message.content) {
            content.push({ type: 'text', text: choice.message.content })
        }

        // Tool calls → tool_use blocks
        if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
            for (const tc of choice.message.tool_calls) {
                let input: Record<string, unknown> = {}
                try {
                    input = JSON.parse(tc.function.arguments)
                } catch {
                    input = { _raw: tc.function.arguments }
                }
                content.push({
                    type: 'tool_use',
                    id: tc.id,
                    name: tc.function.name,
                    input,
                })
            }
        }

        // Ensure at least one content block
        if (content.length === 0) {
            content.push({ type: 'text', text: '' })
        }

        return {
            id: resp.id || `msg_${Date.now()}`,
            type: 'message',
            role: 'assistant',
            content,
            model: originalModel,
            stop_reason: this.mapStopReason(choice.finish_reason),
            stop_sequence: null,
            usage: {
                input_tokens: resp.usage?.prompt_tokens ?? 0,
                output_tokens: resp.usage?.completion_tokens ?? 0,
                ...(resp.usage?.prompt_tokens_details?.cached_tokens !== undefined && {
                    cache_read_input_tokens: resp.usage.prompt_tokens_details.cached_tokens,
                }),
            }
        }
    }

    /**
     * Map OpenAI finish_reason to Claude stop_reason
     */
    private static mapStopReason(
        reason: string | null
    ): ClaudeMessageResponse['stop_reason'] {
        switch (reason) {
            case 'stop': return 'end_turn'
            case 'length': return 'max_tokens'
            case 'tool_calls': return 'tool_use'
            case 'content_filter': return 'end_turn'
            default: return 'end_turn'
        }
    }

    // ==================== OpenAI → Claude (Streaming) ====================

    /**
     * Create initial stream state
     */
    static createStreamState(): ClaudeStreamState {
        return {
            messageStartSent: false,
            contentBlockIndex: 0,
            contentBlockOpen: false,
            toolCalls: {},
        }
    }

    /**
     * Translate an OpenAI streaming chunk to Claude streaming events
     */
    static translateChunkToClaudeEvents(
        chunk: OpenAIChatCompletionChunk,
        state: ClaudeStreamState,
        originalModel: string
    ): ClaudeStreamEvent[] {
        const events: ClaudeStreamEvent[] = []

        // Send message_start on first chunk
        if (!state.messageStartSent) {
            events.push({
                type: 'message_start',
                message: {
                    id: chunk.id || `msg_${Date.now()}`,
                    type: 'message',
                    role: 'assistant',
                    content: [],
                    model: originalModel,
                    stop_reason: null,
                    stop_sequence: null,
                    usage: {
                        input_tokens: chunk.usage?.prompt_tokens ?? 0,
                        output_tokens: 0,
                        ...(chunk.usage?.prompt_tokens_details?.cached_tokens !== undefined && {
                            cache_read_input_tokens: chunk.usage.prompt_tokens_details.cached_tokens,
                        }),
                    }
                }
            })
            state.messageStartSent = true
        }

        if (!chunk.choices || chunk.choices.length === 0) return events

        const choice = chunk.choices[0]
        const delta = choice.delta

        // Handle text content
        if (delta?.content) {
            // If a tool block is open, close it first
            if (this.isToolBlockOpen(state)) {
                events.push({ type: 'content_block_stop', index: state.contentBlockIndex })
                state.contentBlockIndex++
                state.contentBlockOpen = false
            }

            // Open a text content block if not already open
            if (!state.contentBlockOpen) {
                events.push({
                    type: 'content_block_start',
                    index: state.contentBlockIndex,
                    content_block: { type: 'text', text: '' }
                })
                state.contentBlockOpen = true
            }

            events.push({
                type: 'content_block_delta',
                index: state.contentBlockIndex,
                delta: { type: 'text_delta', text: delta.content }
            })
        }

        // Handle tool calls
        if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
                if (tc.id && tc.function?.name) {
                    // New tool call starting — close any open block
                    if (state.contentBlockOpen) {
                        events.push({ type: 'content_block_stop', index: state.contentBlockIndex })
                        state.contentBlockIndex++
                        state.contentBlockOpen = false
                    }

                    const blockIndex = state.contentBlockIndex
                    state.toolCalls[tc.index] = {
                        id: tc.id,
                        name: tc.function.name,
                        anthropicBlockIndex: blockIndex,
                    }

                    events.push({
                        type: 'content_block_start',
                        index: blockIndex,
                        content_block: {
                            type: 'tool_use',
                            id: tc.id,
                            name: tc.function.name,
                            input: {},
                        }
                    })
                    state.contentBlockOpen = true
                }

                // Accumulate tool call arguments
                if (tc.function?.arguments) {
                    const info = state.toolCalls[tc.index]
                    if (info) {
                        events.push({
                            type: 'content_block_delta',
                            index: info.anthropicBlockIndex,
                            delta: {
                                type: 'input_json_delta',
                                partial_json: tc.function.arguments,
                            }
                        })
                    }
                }
            }
        }

        // Handle finish
        if (choice.finish_reason) {
            if (state.contentBlockOpen) {
                events.push({ type: 'content_block_stop', index: state.contentBlockIndex })
                state.contentBlockOpen = false
            }

            events.push({
                type: 'message_delta',
                delta: {
                    stop_reason: this.mapStopReason(choice.finish_reason),
                    stop_sequence: null,
                },
                usage: {
                    input_tokens: chunk.usage?.prompt_tokens ?? 0,
                    output_tokens: chunk.usage?.completion_tokens ?? 0,
                }
            })

            events.push({ type: 'message_stop' })
        }

        return events
    }

    /**
     * Check if the currently open block is a tool block
     */
    private static isToolBlockOpen(state: ClaudeStreamState): boolean {
        return state.contentBlockOpen &&
            Object.values(state.toolCalls).some(
                tc => tc.anthropicBlockIndex === state.contentBlockIndex
            )
    }

    /**
     * Serialize Claude stream events to SSE format
     */
    static serializeClaudeEvents(events: ClaudeStreamEvent[]): string {
        const lines: string[] = []
        for (const event of events) {
            lines.push(`event: ${event.type}`)
            lines.push(`data: ${JSON.stringify(event)}`)
            lines.push('')
        }
        return lines.join('\n')
    }

    // ==================== Validation & Errors ====================

    /**
     * Create a Claude-formatted error response
     */
    static createClaudeError(
        type: string,
        message: string,
        statusCode: number = 400
    ): { statusCode: number; body: any } {
        return {
            statusCode,
            body: {
                type: 'error',
                error: { type, message }
            }
        }
    }

    /**
     * Validate a Claude request has required fields
     */
    static validateClaudeRequest(req: any): { valid: boolean; error?: string } {
        if (!req.model) {
            return { valid: false, error: 'model is required' }
        }

        if (!req.messages || !Array.isArray(req.messages) || req.messages.length === 0) {
            return { valid: false, error: 'messages must be a non-empty array' }
        }

        if (req.max_tokens === undefined || req.max_tokens === null) {
            return { valid: false, error: 'max_tokens is required' }
        }

        if (typeof req.max_tokens !== 'number' || req.max_tokens < 1) {
            return { valid: false, error: 'max_tokens must be a positive number' }
        }

        for (let i = 0; i < req.messages.length; i++) {
            const msg = req.messages[i]
            if (!msg.role || (msg.role !== 'user' && msg.role !== 'assistant')) {
                return { valid: false, error: `messages[${i}].role must be 'user' or 'assistant'` }
            }
            if (msg.content === undefined) {
                return { valid: false, error: `messages[${i}].content is required` }
            }
        }

        return { valid: true }
    }
}
