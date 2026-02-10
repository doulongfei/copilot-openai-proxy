import express, {Request, Response} from 'express'
import path from 'path'
import fetch from 'node-fetch'
import {copilotService} from './copilot'
import {storage} from './storage'
import {OpenAIChatCompletionRequest, OpenAIChatCompletionResponse, OpenAIChatCompletionChunk, ClaudeMessageRequest} from './types'
import {authMiddleware} from './auth'
import {FormatConverter} from './converter'
import {Transform} from 'stream'

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(express.json({limit: '50mb'}))
app.use(express.urlencoded({extended: true}))
app.use(express.static(path.join(__dirname, '../public')))
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, '../views'))

// Home page
app.get('/', async (req: Request, res: Response) => {
    const status = await copilotService.getStatus()
    res.render('index', {status})
})

// Authorization page
app.get('/auth', async (req: Request, res: Response) => {
    try {
        const deviceCode = await copilotService.getDeviceCode()
        res.render('auth', {deviceCode})
    } catch (error) {
        res.status(500).send(`Error: ${(error as Error).message}`)
    }
})

// Success page
app.get('/success', async (req: Request, res: Response) => {
    const status = await copilotService.getStatus()
    if (!status.authorized) {
        res.redirect('/auth')
        return
    }
    res.render('success', {status})
})

// API: Get status
app.get('/api/status', async (req: Request, res: Response) => {
    try {
        const status = await copilotService.getStatus()
        res.json(status)
    } catch (error) {
        res.status(500).json({error: (error as Error).message})
    }
})

// API: Poll for authorization
app.post('/api/poll-auth', async (req: Request, res: Response) => {
    try {
        const {device_code} = req.body
        const result = await copilotService.pollForAccessToken(device_code)

        if (result.access_token) {
            const auth = await copilotService.completeAuthorization(result.access_token)
            res.json({success: true, authorized: true, user: auth.user})
        } else if (result.error === 'authorization_pending') {
            res.json({success: true, authorized: false, pending: true})
        } else {
            res.json({success: false, error: result.error})
        }
    } catch (error) {
        res.status(500).json({success: false, error: (error as Error).message})
    }
})

// API: Test chat completion
app.post('/api/test', async (req: Request, res: Response) => {
    try {
        const token = await copilotService.getValidCopilotToken()

        const response = await fetch('https://api.githubcopilot.com/chat/completions', {
            method: 'POST',
            headers: copilotService.buildHeaders(token),
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [{role: 'user', content: 'Say "Hello from Copilot!"'}],
                stream: false
            })
        })

        const data = await response.json()
        res.json(data)
    } catch (error) {
        res.status(500).json({error: (error as Error).message})
    }
})

// OpenAI Compatible API: List models
app.get('/v1/models', authMiddleware, async (req: Request, res: Response) => {
    try {
        const modelsData = await copilotService.getModels()

        if (modelsData.data && Array.isArray(modelsData.data)) {
            res.json(modelsData)
        } else {
            res.json({
                object: 'list',
                data: modelsData
            })
        }
    } catch (error) {
        console.error('Failed to get models:', error)
        res.status(401).json({
            error: {
                message: 'Unauthorized. Please authorize first.',
                type: 'authentication_error',
                code: 'unauthorized'
            }
        })
    }
})

// OpenAI Compatible API: Chat completions
app.post('/v1/chat/completions', authMiddleware, async (req: Request, res: Response) => {
    try {
        const token = await copilotService.getValidCopilotToken()
        const body: OpenAIChatCompletionRequest = req.body

        // Check vision and agent status
        const isVision = await copilotService.isVisionModel(body.model)
        const isAgent = copilotService.isAgentRequest(body)

        if (isVision) {
            console.log(`Model ${body.model} supports vision`)
        }
        if (isAgent) {
            console.log(`Request detected as agent call (tool role or tool_calls present)`)
        }

        // Validate multimodal content for non-vision models
        for (const message of body.messages) {
            if (Array.isArray(message.content)) {
                if (!isVision) {
                    return res.status(400).json({
                        error: {
                            message: `Model ${body.model} does not support vision/multimodal content`,
                            type: 'invalid_request_error',
                            code: 'model_not_support_vision'
                        }
                    })
                }

                for (const part of message.content) {
                    if (part.type === 'image_url') {
                        if (!part.image_url?.url) {
                            return res.status(400).json({
                                error: {
                                    message: 'Invalid image_url format: url is required',
                                    type: 'invalid_request_error',
                                    code: 'invalid_image_url'
                                }
                            })
                        }
                    }
                }
            }
        }

        const headers = copilotService.buildHeaders(token, {vision: isVision, isAgent})

        const response = await fetch('https://api.githubcopilot.com/chat/completions', {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`Copilot API error: ${response.status} - ${errorText}`)
            let errorJson: any
            try {
                errorJson = JSON.parse(errorText)
            } catch {
                errorJson = {error: {message: errorText, type: 'upstream_error'}}
            }
            return res.status(response.status).json(errorJson)
        }

        // Handle streaming
        if (body.stream) {
            res.setHeader('Content-Type', 'text/event-stream')
            res.setHeader('Cache-Control', 'no-cache')
            res.setHeader('Connection', 'keep-alive')

            response.body?.pipe(res)
        } else {
            const data = await response.json()
            res.json(data)
        }
    } catch (error) {
        console.error('Chat completions error:', error)
        res.status(500).json({
            error: {
                message: (error as Error).message,
                type: 'proxy_error',
                code: 'internal_error'
            }
        })
    }
})

// Get vision models list (debug endpoint)
app.get('/v1/models/vision', authMiddleware, async (req: Request, res: Response) => {
    try {
        const visionModels = await copilotService.getVisionModels()
        res.json({
            object: 'list',
            data: visionModels
        })
    } catch (error) {
        res.status(500).json({
            error: {
                message: (error as Error).message,
                type: 'proxy_error',
                code: 'internal_error'
            }
        })
    }
})

// ==================== Claude API Compatible Endpoints ====================

// Claude API: Create a message
app.post('/v1/messages', authMiddleware, async (req: Request, res: Response) => {
    try {
        console.log('[Claude API] Received request to /v1/messages')

        const anthropicVersion = req.headers['anthropic-version'] as string | undefined
        if (!anthropicVersion) {
            console.warn('[Claude API] Missing anthropic-version header')
        } else {
            console.log(`[Claude API] anthropic-version: ${anthropicVersion}`)
        }

        const claudeRequest = req.body as ClaudeMessageRequest

        // Validate request
        const validation = FormatConverter.validateClaudeRequest(claudeRequest)
        if (!validation.valid) {
            console.error(`[Claude API] Validation failed: ${validation.error}`)
            const error = FormatConverter.createClaudeError(
                'invalid_request_error',
                validation.error!,
                400
            )
            return res.status(error.statusCode).json(error.body)
        }

        console.log(`[Claude API] Model: ${claudeRequest.model}, Stream: ${claudeRequest.stream || false}, Tools: ${claudeRequest.tools?.length || 0}`)

        // Convert Claude request to OpenAI format
        const openAIRequest = FormatConverter.claudeToOpenAI(claudeRequest)
        console.log(`[Claude API] Converted to OpenAI format - Model: ${openAIRequest.model}`)

        // Get Copilot token
        const token = await copilotService.getValidCopilotToken()

        // Check vision and agent status
        const isVision = await copilotService.isVisionModel(openAIRequest.model)
        const isAgent = copilotService.isAgentRequest(openAIRequest)

        const headers = copilotService.buildHeaders(token, {vision: isVision, isAgent})

        // Call Copilot API
        const response = await fetch('https://api.githubcopilot.com/chat/completions', {
            method: 'POST',
            headers,
            body: JSON.stringify(openAIRequest)
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`[Claude API] Copilot API error: ${response.status} - ${errorText}`)
            const error = FormatConverter.createClaudeError(
                'api_error',
                `Upstream API error: ${response.statusText}`,
                response.status
            )
            return res.status(error.statusCode).json(error.body)
        }

        // Handle streaming response
        if (claudeRequest.stream) {
            console.log('[Claude API] Streaming response')

            res.setHeader('Content-Type', 'text/event-stream')
            res.setHeader('Cache-Control', 'no-cache')
            res.setHeader('Connection', 'keep-alive')

            const streamState = FormatConverter.createStreamState()
            let buffer = ''
            let streamFinished = false

            const transformStream = new Transform({
                transform(chunk: Buffer, encoding: string, callback: Function) {
                    try {
                        buffer += chunk.toString()
                        const lines = buffer.split('\n')
                        buffer = lines.pop() || ''

                        for (const line of lines) {
                            if (!line.trim()) continue

                            if (line.startsWith('data: ')) {
                                const data = line.slice(6)

                                if (data === '[DONE]') {
                                    // Only emit terminal events if not already sent by finish_reason
                                    if (!streamFinished) {
                                        if (streamState.contentBlockOpen) {
                                            const stopEvent = {type: 'content_block_stop' as const, index: streamState.contentBlockIndex}
                                            this.push(`event: content_block_stop\ndata: ${JSON.stringify(stopEvent)}\n\n`)
                                            streamState.contentBlockOpen = false
                                        }
                                        const deltaEvent = {
                                            type: 'message_delta' as const,
                                            delta: {stop_reason: 'end_turn' as const, stop_sequence: null},
                                            usage: {input_tokens: 0, output_tokens: 0}
                                        }
                                        this.push(`event: message_delta\ndata: ${JSON.stringify(deltaEvent)}\n\n`)
                                        const stopMsg = {type: 'message_stop' as const}
                                        this.push(`event: message_stop\ndata: ${JSON.stringify(stopMsg)}\n\n`)
                                        streamFinished = true
                                    }
                                    continue
                                }

                                try {
                                    const chunk = JSON.parse(data) as OpenAIChatCompletionChunk
                                    const events = FormatConverter.translateChunkToClaudeEvents(
                                        chunk,
                                        streamState,
                                        claudeRequest.model
                                    )

                                    // Check if finish_reason was handled
                                    if (events.some(e => e.type === 'message_stop')) {
                                        streamFinished = true
                                    }

                                    const serialized = FormatConverter.serializeClaudeEvents(events)
                                    if (serialized) {
                                        this.push(serialized + '\n')
                                    }
                                } catch {
                                    // Ignore parse errors
                                }
                            }
                        }
                        callback()
                    } catch (error) {
                        console.error('[Claude API] Stream transform error:', error)
                        callback(error)
                    }
                },
                flush(callback: Function) {
                    if (buffer.trim()) {
                        if (buffer.startsWith('data: ')) {
                            const data = buffer.slice(6)
                            if (data !== '[DONE]') {
                                try {
                                    const chunk = JSON.parse(data) as OpenAIChatCompletionChunk
                                    const events = FormatConverter.translateChunkToClaudeEvents(
                                        chunk,
                                        streamState,
                                        claudeRequest.model
                                    )
                                    if (events.some(e => e.type === 'message_stop')) {
                                        streamFinished = true
                                    }
                                    const serialized = FormatConverter.serializeClaudeEvents(events)
                                    if (serialized) {
                                        this.push(serialized + '\n')
                                    }
                                } catch {
                                    // Ignore
                                }
                            }
                        }
                    }
                    callback()
                }
            })

            response.body?.pipe(transformStream).pipe(res)

            transformStream.on('error', (error) => {
                console.error('[Claude API] Transform stream error:', error)
                res.end()
            })

            res.on('close', () => {
                console.log('[Claude API] Client closed connection')
            })
        } else {
            // Non-streaming response
            console.log('[Claude API] Non-streaming response')

            const openAIResponse = await response.json() as OpenAIChatCompletionResponse
            const claudeResponse = FormatConverter.openAIToClaude(
                openAIResponse,
                claudeRequest.model
            )

            console.log(`[Claude API] Response - Stop reason: ${claudeResponse.stop_reason}, Content blocks: ${claudeResponse.content.length}`)
            res.json(claudeResponse)
        }
    } catch (error) {
        console.error('[Claude API] Error:', error)
        const errorResponse = FormatConverter.createClaudeError(
            'internal_server_error',
            (error as Error).message,
            500
        )
        res.status(errorResponse.statusCode).json(errorResponse.body)
    }
})

// Health check
app.get('/health', (req: Request, res: Response) => {
    res.json({status: 'ok', timestamp: Date.now()})
})

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 Copilot OpenAI Proxy Server is running!`)
    console.log(`📍 URL: http://localhost:${PORT}`)
    console.log(`\n📖 Quick Start:`)
    console.log(`   1. Open http://localhost:${PORT} in your browser`)
    console.log(`   2. Complete GitHub authorization`)
    console.log(`   3. Use the OpenAI API endpoint: http://localhost:${PORT}/v1/chat/completions`)
    console.log(`\n`)
})
