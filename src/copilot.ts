import fetch from 'node-fetch'
import {randomUUID} from 'crypto'
import {
    DeviceCodeResponse,
    AccessTokenResponse,
    CopilotTokenResponse,
    GitHubUserResponse,
    StoredAuth,
    ModelsResponse,
    ModelInfo,
    OpenAIChatCompletionRequest
} from './types'
import {storage} from './storage'

const GITHUB_CLIENT_ID = 'Iv1.b507a08c87ecfe98'
const MAX_POLLING_ATTEMPTS = 120 // 10 minutes max

const COPILOT_VERSION = '0.26.7'
const EDITOR_VERSION = 'vscode/1.104.1'
const API_VERSION = '2025-04-01'

const COPILOT_HEADERS: Record<string, string> = {
    'content-type': 'application/json',
    'copilot-integration-id': 'vscode-chat',
    'editor-version': EDITOR_VERSION,
    'editor-plugin-version': `copilot-chat/${COPILOT_VERSION}`,
    'user-agent': `GitHubCopilotChat/${COPILOT_VERSION}`,
    'openai-intent': 'conversation-panel',
    'x-github-api-version': API_VERSION,
    'accept': '*/*',
    'accept-encoding': 'gzip,deflate,br'
}

class CopilotService {
    private pollingDeviceCode: string | null = null
    private pollingAttempts = 0

    // Model cache
    private modelsCache: ModelsResponse | null = null
    private modelsCacheTime: number = 0
    private readonly CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

    /**
     * Build request headers for Copilot API calls
     */
    buildHeaders(token: string, options?: { vision?: boolean; isAgent?: boolean }): Record<string, string> {
        const headers: Record<string, string> = {
            ...COPILOT_HEADERS,
            'Authorization': `Bearer ${token}`,
            'x-request-id': randomUUID(),
        }

        if (options?.vision) {
            headers['copilot-vision-request'] = 'true'
        }

        if (options?.isAgent) {
            headers['x-initiator'] = 'agent'
        }

        return headers
    }

    /**
     * Detect if a request contains agent-pattern messages (tool role or assistant with tool_calls)
     */
    isAgentRequest(body: OpenAIChatCompletionRequest): boolean {
        return body.messages.some(msg =>
            msg.role === 'tool' ||
            (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0)
        )
    }

    // Step 1: Get device code
    async getDeviceCode(): Promise<DeviceCodeResponse> {
        const response = await fetch('https://github.com/login/device/code', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                client_id: GITHUB_CLIENT_ID,
                scope: 'read:user'
            })
        })

        if (!response.ok) {
            throw new Error(`Failed to get device code: ${response.statusText}`)
        }

        const data = await response.json() as DeviceCodeResponse
        this.pollingDeviceCode = data.device_code
        this.pollingAttempts = 0
        return data
    }

    // Step 2: Poll for access token
    async pollForAccessToken(deviceCode?: string): Promise<AccessTokenResponse> {
        const code = deviceCode || this.pollingDeviceCode
        if (!code) {
            throw new Error('No device code available')
        }

        if (this.pollingAttempts >= MAX_POLLING_ATTEMPTS) {
            throw new Error('Polling timeout')
        }

        this.pollingAttempts++

        const response = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                client_id: GITHUB_CLIENT_ID,
                device_code: code,
                grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
            })
        })

        if (!response.ok) {
            throw new Error(`Failed to get access token: ${response.statusText}`)
        }

        const data = await response.json() as AccessTokenResponse

        if (data.access_token) {
            this.pollingDeviceCode = null
            this.pollingAttempts = 0
        }

        return data
    }

    // Step 3: Get GitHub user info
    async getGitHubUser(accessToken: string): Promise<GitHubUserResponse> {
        const response = await fetch('https://api.github.com/user', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': `token ${accessToken}`,
                'User-Agent': 'copilot-openai-proxy'
            }
        })

        if (!response.ok) {
            throw new Error(`Failed to get user info: ${response.statusText}`)
        }

        return await response.json() as GitHubUserResponse
    }

    // Step 4: Get Copilot token
    async getCopilotToken(accessToken: string): Promise<CopilotTokenResponse> {
        const response = await fetch('https://api.github.com/copilot_internal/v2/token', {
            method: 'GET',
            headers: {
                ...COPILOT_HEADERS,
                'Authorization': `token ${accessToken}`
            }
        })

        if (!response.ok) {
            throw new Error(`Failed to get Copilot token: ${response.statusText}`)
        }

        return await response.json() as CopilotTokenResponse
    }

    // Complete authorization flow
    async completeAuthorization(accessToken: string): Promise<StoredAuth> {
        // Get user info
        const user = await this.getGitHubUser(accessToken)

        // Get Copilot token
        const copilotToken = await this.getCopilotToken(accessToken)

        // Save to storage
        const auth: StoredAuth = {
            accessToken,
            copilotToken: copilotToken.token,
            copilotTokenExpiresAt: copilotToken.expires_at,
            user: {
                login: user.login,
                avatar: user.avatar_url,
                name: user.name
            },
            createdAt: Date.now(),
            updatedAt: Date.now()
        }

        await storage.saveAuth(auth)
        return auth
    }

    // Get valid Copilot token (refresh if needed)
    async getValidCopilotToken(): Promise<string> {
        const auth = await storage.getAuth()
        if (!auth) {
            throw new Error('Not authorized. Please complete authorization first.')
        }

        // Check if token is still valid (refresh 5 minutes before expiry)
        // Note: copilotTokenExpiresAt is in seconds (Unix timestamp), Date.now() is in milliseconds
        const nowSeconds = Math.floor(Date.now() / 1000)
        const expiresAt = auth.copilotTokenExpiresAt || 0
        const shouldRefresh = !auth.copilotToken || (expiresAt - nowSeconds < 300)

        if (shouldRefresh) {
            console.log('Refreshing Copilot token...')
            const copilotToken = await this.getCopilotToken(auth.accessToken)
            auth.copilotToken = copilotToken.token
            auth.copilotTokenExpiresAt = copilotToken.expires_at
            auth.updatedAt = Date.now()
            await storage.saveAuth(auth)
        }

        return auth.copilotToken!
    }

    // Get authorization status
    async getStatus(): Promise<{
        authorized: boolean
        user?: StoredAuth['user']
        expiresAt?: number
    }> {
        const auth = await storage.getAuth()
        if (!auth) {
            return {authorized: false}
        }

        return {
            authorized: true,
            user: auth.user,
            expiresAt: auth.copilotTokenExpiresAt
        }
    }

    // Get available models from Copilot API (with cache)
    async getModels(forceRefresh = false): Promise<ModelsResponse> {
        const now = Date.now()

        if (!forceRefresh &&
            this.modelsCache &&
            (now - this.modelsCacheTime) < this.CACHE_DURATION) {
            console.log('Using cached models data')
            return this.modelsCache
        }

        console.log('Fetching fresh models data from Copilot API')
        const token = await this.getValidCopilotToken()

        const response = await fetch('https://api.githubcopilot.com/models', {
            method: 'GET',
            headers: this.buildHeaders(token)
        })

        if (!response.ok) {
            throw new Error(`Failed to get models: ${response.statusText}`)
        }

        const data = await response.json() as ModelsResponse

        this.modelsCache = data
        this.modelsCacheTime = now

        return data
    }

    // Check if model supports vision
    async isVisionModel(modelId: string): Promise<boolean> {
        try {
            const models = await this.getModels()
            const model = models.data.find(m => m.id === modelId)

            if (!model) {
                console.warn(`Model ${modelId} not found in models list, using fallback`)
                return this.isVisionModelFallback(modelId)
            }

            if (model.capabilities?.supports?.vision === true) {
                console.log(`Model ${modelId} supports vision (from API)`)
                return true
            }

            console.log(`Model ${modelId} does not support vision (from API)`)
            return false
        } catch (error) {
            console.error('Error checking vision support:', error)
            return this.isVisionModelFallback(modelId)
        }
    }

    // Fallback vision model detection (name-based)
    private isVisionModelFallback(modelId: string): boolean {
        const visionPatterns = [
            /gpt-4o/i,
            /gpt-4.*vision/i,
            /claude-3/i,
            /claude.*opus/i,
            /claude.*sonnet/i,
            /gemini/i,
            /\bo1\b/i,
            /\bo3\b/i,
            /\bo4\b/i,
        ]

        return visionPatterns.some(pattern => pattern.test(modelId))
    }

    // Get all vision-capable models
    async getVisionModels(): Promise<ModelInfo[]> {
        const models = await this.getModels()
        return models.data.filter(m => m.capabilities?.supports?.vision === true)
    }

    // Clear model cache
    clearModelsCache(): void {
        this.modelsCache = null
        this.modelsCacheTime = 0
    }
}

export const copilotService = new CopilotService()
