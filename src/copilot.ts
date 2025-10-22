import fetch from 'node-fetch'
import {
    DeviceCodeResponse,
    AccessTokenResponse,
    CopilotTokenResponse,
    GitHubUserResponse,
    StoredAuth,
    ModelsResponse,
    ModelInfo
} from './types'
import {storage} from './storage'

const GITHUB_CLIENT_ID = 'Iv1.b507a08c87ecfe98'
const POLLING_INTERVAL = 5000 // 5 seconds
const MAX_POLLING_ATTEMPTS = 120 // 10 minutes max

const COPILOT_HEADERS = {
    'Accept': 'application/json',
    'Editor-Version': 'vscode/1.104.1',
    'Editor-Plugin-Version': 'copilot-chat/0.26.7',
    'User-Agent': 'GitHubCopilotChat/0.26.7',
    'Copilot-Integration-Id': 'vscode-chat'
}

class CopilotService {
    private pollingDeviceCode: string | null = null
    private pollingAttempts = 0

    // 模型缓存
    private modelsCache: ModelsResponse | null = null
    private modelsCacheTime: number = 0
    // 24小时缓存
    private readonly CACHE_DURATION = 24 * 60 * 60 * 1000

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

        // Check if token is still valid (refresh 1 hour before expiry)
        const now = Date.now()
        const expiresAt = auth.copilotTokenExpiresAt || 0
        const shouldRefresh = !auth.copilotToken || (expiresAt - now < 3600000)

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

        // 检查缓存是否有效
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
            headers: {
                ...COPILOT_HEADERS,
                'Authorization': `Bearer ${token}`
            }
        })

        if (!response.ok) {
            throw new Error(`Failed to get models: ${response.statusText}`)
        }

        const data = await response.json() as ModelsResponse

        // 更新缓存
        this.modelsCache = data
        this.modelsCacheTime = now

        return data
    }

    // 检查模型是否支持视觉
    async isVisionModel(modelId: string): Promise<boolean> {
        try {
            const models = await this.getModels()

            // 在模型列表中查找对应模型
            const model = models.data.find(m => m.id === modelId)

            if (!model) {
                console.warn(`Model ${modelId} not found in models list, using fallback`)
                // 如果找不到模型，使用后备方案（基于模型名称判断）
                return this.isVisionModelFallback(modelId)
            }

            // 检查 capabilities.supports.vision 字段（根据实际 API 响应）
            if (model.capabilities?.supports?.vision === true) {
                console.log(`Model ${modelId} supports vision (from API)`)
                return true
            }

            // 如果 API 没有提供 vision 支持信息，返回 false
            console.log(`Model ${modelId} does not support vision (from API)`)
            return false
        } catch (error) {
            console.error('Error checking vision support:', error)
            // 出错时使用后备方案
            return this.isVisionModelFallback(modelId)
        }
    }

    // 后备的视觉模型检测（基于模型名称）
    private isVisionModelFallback(modelId: string): boolean {
        // 已知支持视觉的模型名称模式
        const visionPatterns = [
            /gpt-4o/i,
            /gpt-4.*vision/i,
            /claude-3/i,
            /claude.*opus/i,
            /gemini.*vision/i,
            /o1/i,
            /o1-mini/i
        ]

        return visionPatterns.some(pattern => pattern.test(modelId))
    }

    // 获取所有支持视觉的模型列表
    async getVisionModels(): Promise<ModelInfo[]> {
        const models = await this.getModels()
        return models.data.filter(m => m.capabilities?.supports?.vision === true)
    }

    // 清除缓存（用于调试或强制刷新）
    clearModelsCache(): void {
        this.modelsCache = null
        this.modelsCacheTime = 0
    }
}

export const copilotService = new CopilotService()
