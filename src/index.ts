import express, {Request, Response} from 'express'
import path from 'path'
import fetch from 'node-fetch'
import {copilotService} from './copilot'
import {storage} from './storage'
import {OpenAIChatCompletionRequest} from './types'
import {authMiddleware} from './auth'

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
