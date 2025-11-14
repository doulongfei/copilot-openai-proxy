import express, {Request, Response} from 'express'
import path from 'path'
import fetch from 'node-fetch'
import {copilotService} from './copilot'
import {storage} from './storage'
import {OpenAIChatCompletionRequest, ClaudeMessageRequest} from './types'
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
            // Complete authorization
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
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Editor-Version': 'vscode/1.104.1',
                'Editor-Plugin-Version': 'copilot-chat/0.26.7',
                'User-Agent': 'GitHubCopilotChat/0.26.7',
                'Copilot-Integration-Id': 'vscode-chat'
            },
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

// API: Logout
app.post('/api/logout', async (req: Request, res: Response) => {
    try {
        await storage.clearAuth()
        res.json({success: true})
    } catch (error) {
        res.status(500).json({error: (error as Error).message})
    }
})

// OpenAI Compatible API: List models
app.get('/v1/models', authMiddleware, async (req: Request, res: Response) => {
    try {
        const modelsData = await copilotService.getModels()

        // Transform Copilot API response to OpenAI format
        if (modelsData.data && Array.isArray(modelsData.data)) {
            // Copilot API returns models in format similar to OpenAI
            res.json(modelsData)
        } else {
            // Fallback to transformed format if structure is different
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

        // 检查是否为视觉模型
        const isVision = await copilotService.isVisionModel(body.model)
        
        if (isVision) {
            console.log(`Model ${body.model} supports vision`)
        }

        // 验证消息内容格式
        for (const message of body.messages) {
            if (Array.isArray(message.content)) {
                // 检查是否为非视觉模型使用了多模态内容
                if (!isVision) {
                    return res.status(400).json({
                        error: {
                            message: `Model ${body.model} does not support vision/multimodal content`,
                            type: 'invalid_request_error',
                            code: 'model_not_support_vision'
                        }
                    })
                }
                
                // 验证图片内容格式
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

        const response = await fetch('https://api.githubcopilot.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Editor-Version': 'vscode/1.104.1',
                'Editor-Plugin-Version': 'copilot-chat/0.26.7',
                'User-Agent': 'GitHubCopilotChat/0.26.7',
                'Copilot-Integration-Id': 'vscode-chat',
                ...(isVision ? { 'copilot-vision-request': 'true' } : {})
            },
            body: JSON.stringify(body)
        })

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
        
        // 验证 anthropic-version header
        const anthropicVersion = req.headers['anthropic-version'] as string | undefined
        if (!anthropicVersion) {
            console.warn('[Claude API] Missing anthropic-version header')
            // 不强制要求，但记录警告
        } else {
            console.log(`[Claude API] anthropic-version: ${anthropicVersion}`)
        }

        const claudeRequest = req.body as ClaudeMessageRequest

        // 验证 Claude 请求格式
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

        console.log(`[Claude API] Request validated - Model: ${claudeRequest.model}, Stream: ${claudeRequest.stream || false}`)

        // 转换 Claude 请求为 OpenAI 格式
        const openAIRequest = FormatConverter.claudeToOpenAI(claudeRequest)
        console.log(`[Claude API] Converted to OpenAI format`)

        // 获取 Copilot token
        const token = await copilotService.getValidCopilotToken()

        // 检查是否为视觉模型
        const isVision = await copilotService.isVisionModel(openAIRequest.model)
        if (isVision) {
            console.log(`[Claude API] Model ${openAIRequest.model} supports vision`)
        }

        // 调用 Copilot API
        const response = await fetch('https://api.githubcopilot.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Editor-Version': 'vscode/1.104.1',
                'Editor-Plugin-Version': 'copilot-chat/0.26.7',
                'User-Agent': 'GitHubCopilotChat/0.26.7',
                'Copilot-Integration-Id': 'vscode-chat',
                ...(isVision ? { 'copilot-vision-request': 'true' } : {})
            },
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

        // 处理流式响应
        if (claudeRequest.stream) {
            console.log('[Claude API] Streaming response')
            
            res.setHeader('Content-Type', 'text/event-stream')
            res.setHeader('Cache-Control', 'no-cache')
            res.setHeader('Connection', 'keep-alive')

            let isFirstChunk = true
            let buffer = ''

            // 创建转换流
            const transformStream = new Transform({
                transform(chunk: Buffer, encoding: string, callback: Function) {
                    try {
                        buffer += chunk.toString()
                        const lines = buffer.split('\n')
                        buffer = lines.pop() || ''

                        for (const line of lines) {
                            if (line.trim()) {
                                const converted = FormatConverter.transformStreamChunk(
                                    line + '\n',
                                    isFirstChunk,
                                    claudeRequest.model
                                )
                                if (converted) {
                                    this.push(converted)
                                    isFirstChunk = false
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
                        try {
                            const converted = FormatConverter.transformStreamChunk(
                                buffer,
                                isFirstChunk,
                                claudeRequest.model
                            )
                            if (converted) {
                                this.push(converted)
                            }
                        } catch (error) {
                            console.error('[Claude API] Stream flush error:', error)
                        }
                    }
                    callback()
                }
            })

            response.body?.pipe(transformStream).pipe(res)

            // 处理错误
            transformStream.on('error', (error) => {
                console.error('[Claude API] Transform stream error:', error)
                res.end()
            })

            res.on('close', () => {
                console.log('[Claude API] Client closed connection')
            })
        } else {
            // 非流式响应
            console.log('[Claude API] Non-streaming response')
            
            const openAIResponse = await response.json()
            const claudeResponse = FormatConverter.openAIToClaude(
                openAIResponse,
                claudeRequest.model
            )

            console.log(`[Claude API] Response generated - Stop reason: ${claudeResponse.stop_reason}`)
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
