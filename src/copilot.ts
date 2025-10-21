import fetch from 'node-fetch'
import {
  DeviceCodeResponse,
  AccessTokenResponse,
  CopilotTokenResponse,
  GitHubUserResponse,
  StoredAuth
} from './types'
import { storage } from './storage'

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
      return { authorized: false }
    }

    return {
      authorized: true,
      user: auth.user,
      expiresAt: auth.copilotTokenExpiresAt
    }
  }

  // Get available models from Copilot API
  async getModels(): Promise<any> {
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

    return await response.json()
  }
}

export const copilotService = new CopilotService()
