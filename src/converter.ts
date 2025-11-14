import {
    ClaudeMessageRequest,
    ClaudeMessageResponse,
    ClaudeMessage,
    ClaudeContentBlock,
    ClaudeTextContent,
    ClaudeImageContent,
    ClaudeToolUseContent,
    ClaudeToolResultContent,
    ClaudeStreamEvent,
    OpenAIChatCompletionRequest,
    OpenAIChatCompletionResponse,
    OpenAIChatMessage,
    MessageContent,
    TextPart,
    ImageUrlPart
} from './types'

/**
 * Claude API 和 OpenAI API 格式转换器
 */
export class FormatConverter {
    /**
     * 模型名称映射表
     * 将 Claude 官方 API 的模型名称映射到 Copilot 支持的模型名称
     */
    private static readonly MODEL_MAPPING: Record<string, string> = {
        // Claude 3 系列（官方格式 -> Copilot 格式）
        'claude-3-opus-20240229': 'claude-opus-41',
        'claude-3-5-sonnet-20241022': 'claude-sonnet-4.5',
        'claude-3-5-sonnet-20240620': 'claude-sonnet-4.5',
        'claude-3-sonnet-20240229': 'claude-sonnet-4',
        'claude-3-haiku-20240307': 'claude-haiku-4.5',
        'claude-3-5-haiku-20241022': 'claude-haiku-4.5',
        
        // Claude Sonnet 4 系列（带日期 -> 不带日期）
        'claude-sonnet-4-20250514': 'claude-sonnet-4.5',
        'claude-sonnet-4.5-20250514': 'claude-sonnet-4.5',
        
        // 常见的别名
        'claude-3-opus': 'claude-opus-41',
        'claude-3-sonnet': 'claude-sonnet-4',
        'claude-3-haiku': 'claude-haiku-4.5',
        'claude-3.5-sonnet': 'claude-sonnet-4.5',
        'claude-3.5-haiku': 'claude-haiku-4.5',
        
        // 保持已支持的格式不变
        'claude-opus-41': 'claude-opus-41',
        'claude-sonnet-4.5': 'claude-sonnet-4.5',
        'claude-sonnet-4': 'claude-sonnet-4',
        'claude-haiku-4.5': 'claude-haiku-4.5',
        
        // 短横线格式（4-5 -> 4.5）
        'claude-haiku-4-5': 'claude-haiku-4.5',
        'claude-sonnet-4-5': 'claude-sonnet-4.5',
        'claude-opus-4-1': 'claude-opus-41',
        
        // GPT 模型保持不变（但添加常见别名）
        'gpt-4-turbo': 'gpt-4',
        'gpt-4-turbo-preview': 'gpt-4',
    }

    /**
     * 映射模型名称
     * 将 Claude 官方格式的模型名称转换为 Copilot 支持的格式
     * @param model 原始模型名称
     * @returns 映射后的模型名称
     */
    static mapModelName(model: string): string {
        const mappedModel = this.MODEL_MAPPING[model]
        
        if (mappedModel) {
            if (mappedModel !== model) {
                console.log(`[Model Mapping] ${model} -> ${mappedModel}`)
            }
            return mappedModel
        }
        
        // 如果没有找到精确匹配，尝试模糊匹配
        
        // 首先处理带日期的版本（如 claude-haiku-4-5-20251001）
        // 移除日期部分（8位数字），然后再匹配
        const modelWithoutDate = model.replace(/-\d{8}$/, '')
        if (modelWithoutDate !== model) {
            // 递归调用以处理去掉日期后的模型名
            const result = this.mapModelName(modelWithoutDate)
            if (result !== modelWithoutDate) {
                console.log(`[Model Mapping] ${model} -> ${result} (date stripped + mapped)`)
                return result
            }
        }
        
        // 处理 claude-3 系列
        if (model.startsWith('claude-3-opus')) {
            console.log(`[Model Mapping] ${model} -> claude-opus-41 (fuzzy match)`)
            return 'claude-opus-41'
        }
        if (model.startsWith('claude-3-5-sonnet') || model.startsWith('claude-3.5-sonnet')) {
            console.log(`[Model Mapping] ${model} -> claude-sonnet-4.5 (fuzzy match)`)
            return 'claude-sonnet-4.5'
        }
        if (model.startsWith('claude-3-sonnet')) {
            console.log(`[Model Mapping] ${model} -> claude-sonnet-4 (fuzzy match)`)
            return 'claude-sonnet-4'
        }
        if (model.startsWith('claude-3-haiku') || model.startsWith('claude-3-5-haiku') || model.startsWith('claude-3.5-haiku')) {
            console.log(`[Model Mapping] ${model} -> claude-haiku-4.5 (fuzzy match)`)
            return 'claude-haiku-4.5'
        }
        
        // 处理 claude-haiku-4-5 格式（短横线版本）
        if (model.startsWith('claude-haiku-4-5')) {
            console.log(`[Model Mapping] ${model} -> claude-haiku-4.5 (fuzzy match)`)
            return 'claude-haiku-4.5'
        }
        if (model.startsWith('claude-sonnet-4-5')) {
            console.log(`[Model Mapping] ${model} -> claude-sonnet-4.5 (fuzzy match)`)
            return 'claude-sonnet-4.5'
        }
        if (model.startsWith('claude-opus-4-1')) {
            console.log(`[Model Mapping] ${model} -> claude-opus-41 (fuzzy match)`)
            return 'claude-opus-41'
        }
        
        // 处理 claude-sonnet-4 系列
        if (model.startsWith('claude-sonnet-4')) {
            console.log(`[Model Mapping] ${model} -> claude-sonnet-4.5 (fuzzy match)`)
            return 'claude-sonnet-4.5'
        }
        
        // 没有匹配，返回原始模型名称
        console.warn(`[Model Mapping] No mapping found for model: ${model}, using original name`)
        return model
    }

    /**
     * 将 Claude 请求格式转换为 OpenAI 格式
     */
    static claudeToOpenAI(claudeReq: ClaudeMessageRequest): OpenAIChatCompletionRequest {
        // 首先映射模型名称
        const mappedModel = this.mapModelName(claudeReq.model)
        const openAIMessages: OpenAIChatMessage[] = []

        // 处理系统提示词
        if (claudeReq.system) {
            const systemContent = typeof claudeReq.system === 'string'
                ? claudeReq.system
                : claudeReq.system.map(block => block.text).join('\n')
            
            openAIMessages.push({
                role: 'system',
                content: systemContent
            })
        }

        // 转换消息
        for (const claudeMsg of claudeReq.messages) {
            const openAIMsg: OpenAIChatMessage = {
                role: claudeMsg.role,
                content: this.convertClaudeContentToOpenAI(claudeMsg.content)
            }
            openAIMessages.push(openAIMsg)
        }

        // 构建 OpenAI 请求（使用映射后的模型名称）
        const openAIReq: OpenAIChatCompletionRequest = {
            model: mappedModel,  // 使用映射后的模型名称
            messages: openAIMessages,
            max_tokens: claudeReq.max_tokens,
            stream: claudeReq.stream || false
        }

        // 可选参数
        if (claudeReq.temperature !== undefined) {
            openAIReq.temperature = claudeReq.temperature
        }
        if (claudeReq.top_p !== undefined) {
            openAIReq.top_p = claudeReq.top_p
        }
        if (claudeReq.stop_sequences) {
            openAIReq.stop = claudeReq.stop_sequences
        }

        return openAIReq
    }

    /**
     * 将 Claude 内容转换为 OpenAI 内容格式
     */
    private static convertClaudeContentToOpenAI(
        content: string | ClaudeContentBlock[]
    ): MessageContent {
        if (typeof content === 'string') {
            return content
        }

        // 处理多模态内容
        const parts: Array<TextPart | ImageUrlPart> = []

        for (const block of content) {
            if (block.type === 'text') {
                parts.push({
                    type: 'text',
                    text: (block as ClaudeTextContent).text
                })
            } else if (block.type === 'image') {
                const imageBlock = block as ClaudeImageContent
                let imageUrl: string

                if (imageBlock.source.type === 'base64') {
                    // 转换 base64 格式
                    imageUrl = `data:${imageBlock.source.media_type};base64,${imageBlock.source.data}`
                } else {
                    // URL 格式
                    imageUrl = imageBlock.source.url!
                }

                parts.push({
                    type: 'image_url',
                    image_url: {
                        url: imageUrl
                    }
                })
            }
            // tool_use 和 tool_result 暂时转为文本说明
            else if (block.type === 'tool_use') {
                const toolBlock = block as ClaudeToolUseContent
                parts.push({
                    type: 'text',
                    text: `[Tool Use: ${toolBlock.name}]`
                })
            } else if (block.type === 'tool_result') {
                const resultBlock = block as ClaudeToolResultContent
                const resultText = typeof resultBlock.content === 'string'
                    ? resultBlock.content
                    : '[Tool Result]'
                parts.push({
                    type: 'text',
                    text: resultText
                })
            }
        }

        return parts.length === 1 && parts[0].type === 'text' 
            ? parts[0].text 
            : parts
    }

    /**
     * 将 OpenAI 响应格式转换为 Claude 格式
     */
    static openAIToClaude(
        openAIResp: OpenAIChatCompletionResponse,
        originalModel: string
    ): ClaudeMessageResponse {
        const choice = openAIResp.choices[0]
        const content = choice.message.content

        // 转换内容为 Claude 格式
        const claudeContent: ClaudeContentBlock[] = []

        if (typeof content === 'string') {
            claudeContent.push({
                type: 'text',
                text: content
            })
        } else if (Array.isArray(content)) {
            for (const part of content) {
                if (part.type === 'text') {
                    claudeContent.push({
                        type: 'text',
                        text: part.text
                    })
                }
            }
        }

        // 如果没有内容，添加空文本
        if (claudeContent.length === 0) {
            claudeContent.push({
                type: 'text',
                text: ''
            })
        }

        // 转换停止原因
        let stopReason: ClaudeMessageResponse['stop_reason'] = 'end_turn'
        let stopSequence: string | null = null

        if (choice.finish_reason === 'stop') {
            stopReason = 'end_turn'
        } else if (choice.finish_reason === 'length') {
            stopReason = 'max_tokens'
        } else if (choice.finish_reason === 'tool_calls') {
            stopReason = 'tool_use'
        } else if (choice.finish_reason && choice.finish_reason.startsWith('stop_sequence')) {
            stopReason = 'stop_sequence'
            // 尝试提取停止序列
            stopSequence = choice.finish_reason.replace('stop_sequence:', '')
        }

        return {
            id: openAIResp.id || `msg_${Date.now()}`,
            type: 'message',
            role: 'assistant',
            content: claudeContent,
            model: originalModel,
            stop_reason: stopReason,
            stop_sequence: stopSequence,
            usage: {
                input_tokens: openAIResp.usage?.prompt_tokens || 0,
                output_tokens: openAIResp.usage?.completion_tokens || 0
            }
        }
    }

    /**
     * 转换 OpenAI 流式响应块为 Claude 流式格式
     */
    static transformStreamChunk(openAIChunk: string, isFirst: boolean, originalModel: string): string {
        const lines: string[] = []

        // 处理 message_start 事件（仅第一个块）
        if (isFirst) {
            const messageStart: ClaudeStreamEvent = {
                type: 'message_start',
                message: {
                    id: `msg_${Date.now()}`,
                    type: 'message',
                    role: 'assistant',
                    content: [],
                    model: originalModel,
                    stop_reason: null,
                    stop_sequence: null,
                    usage: {
                        input_tokens: 0,
                        output_tokens: 0
                    }
                }
            }
            lines.push(`event: message_start`)
            lines.push(`data: ${JSON.stringify(messageStart)}`)
            lines.push('')

            // content_block_start 事件
            const contentBlockStart: ClaudeStreamEvent = {
                type: 'content_block_start',
                index: 0,
                content_block: {
                    type: 'text',
                    text: ''
                }
            }
            lines.push(`event: content_block_start`)
            lines.push(`data: ${JSON.stringify(contentBlockStart)}`)
            lines.push('')
        }

        // 解析 OpenAI SSE 格式
        const chunkLines = openAIChunk.split('\n')
        
        for (const line of chunkLines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6)
                
                if (data === '[DONE]') {
                    // 发送 content_block_stop
                    const contentBlockStop: ClaudeStreamEvent = {
                        type: 'content_block_stop',
                        index: 0
                    }
                    lines.push(`event: content_block_stop`)
                    lines.push(`data: ${JSON.stringify(contentBlockStop)}`)
                    lines.push('')

                    // 发送 message_delta
                    const messageDelta: ClaudeStreamEvent = {
                        type: 'message_delta',
                        delta: {
                            type: 'text_delta',
                            stop_reason: 'end_turn',
                            stop_sequence: null
                        },
                        usage: {
                            output_tokens: 0
                        }
                    }
                    lines.push(`event: message_delta`)
                    lines.push(`data: ${JSON.stringify(messageDelta)}`)
                    lines.push('')

                    // 发送 message_stop
                    const messageStop: ClaudeStreamEvent = {
                        type: 'message_stop'
                    }
                    lines.push(`event: message_stop`)
                    lines.push(`data: ${JSON.stringify(messageStop)}`)
                    lines.push('')
                    continue
                }

                try {
                    const chunk = JSON.parse(data)
                    
                    if (chunk.choices && chunk.choices[0]?.delta?.content) {
                        const text = chunk.choices[0].delta.content
                        
                        // 发送 content_block_delta
                        const contentDelta: ClaudeStreamEvent = {
                            type: 'content_block_delta',
                            index: 0,
                            delta: {
                                type: 'text_delta',
                                text: text
                            }
                        }
                        lines.push(`event: content_block_delta`)
                        lines.push(`data: ${JSON.stringify(contentDelta)}`)
                        lines.push('')
                    }
                } catch (e) {
                    // 忽略解析错误
                }
            }
        }

        return lines.join('\n')
    }

    /**
     * 生成 Claude 格式的错误响应
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
                error: {
                    type: type,
                    message: message
                }
            }
        }
    }

    /**
     * 验证 Claude 请求的必需参数
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

        // 验证消息格式
        for (let i = 0; i < req.messages.length; i++) {
            const msg = req.messages[i]
            if (!msg.role || (msg.role !== 'user' && msg.role !== 'assistant')) {
                return { 
                    valid: false, 
                    error: `messages[${i}].role must be 'user' or 'assistant'` 
                }
            }
            if (!msg.content) {
                return { 
                    valid: false, 
                    error: `messages[${i}].content is required` 
                }
            }
        }

        return { valid: true }
    }
}
