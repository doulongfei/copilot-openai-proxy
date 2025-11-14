import { Request, Response, NextFunction } from 'express'

/**
 * Authentication middleware for API endpoints
 * - Allows localhost access without authentication
 * - Requires Bearer token or x-api-key authentication for remote access
 * - Supports both OpenAI (Authorization: Bearer) and Claude (x-api-key) formats
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Get client IP address
  const clientIp = req.ip || req.socket.remoteAddress || ''
  
  // Check if request is from localhost
  const isLocalhost = 
    clientIp === '127.0.0.1' ||
    clientIp === '::1' ||
    clientIp === '::ffff:127.0.0.1' ||
    clientIp.includes('localhost')
  
  // Allow localhost without authentication
  if (isLocalhost) {
    console.log(`[Auth] Localhost access granted from ${clientIp}`)
    return next()
  }
  
  // For remote access, check for either Authorization header or x-api-key
  const authHeader = req.headers.authorization
  const xApiKey = req.headers['x-api-key'] as string | undefined
  
  let token: string | null = null
  let authType: 'bearer' | 'claude' | null = null
  
  // Try Bearer token first (OpenAI format)
  if (authHeader) {
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i)
    if (tokenMatch) {
      token = tokenMatch[1]
      authType = 'bearer'
    }
  }
  
  // If no Bearer token, try x-api-key (Claude format)
  if (!token && xApiKey) {
    token = xApiKey
    authType = 'claude'
  }
  
  // If no authentication provided
  if (!token) {
    console.log(`[Auth] No authentication provided from ${clientIp}`)
    
    // Return appropriate error based on the request path
    const isClaudeEndpoint = req.path.includes('/v1/messages')
    
    if (isClaudeEndpoint) {
      return res.status(401).json({
        type: 'error',
        error: {
          type: 'authentication_error',
          message: 'Authentication required. Please provide x-api-key header.'
        }
      })
    } else {
      return res.status(401).json({
        error: {
          message: 'Authorization required. Please provide a valid Bearer token or x-api-key.',
          type: 'authentication_error',
          code: 'missing_authorization'
        }
      })
    }
  }
  
  // Get allowed tokens from environment variable
  const allowedTokens = process.env.ACCESS_TOKEN 
    ? process.env.ACCESS_TOKEN.split(',').map(t => t.trim())
    : []
  
  // If no tokens configured, reject remote access
  if (allowedTokens.length === 0) {
    console.log(`[Auth] No access tokens configured, rejecting remote access from ${clientIp}`)
    
    const isClaudeEndpoint = req.path.includes('/v1/messages')
    
    if (isClaudeEndpoint) {
      return res.status(401).json({
        type: 'error',
        error: {
          type: 'authentication_error',
          message: 'Remote access is not configured. Please set ACCESS_TOKEN environment variable.'
        }
      })
    } else {
      return res.status(401).json({
        error: {
          message: 'Remote access is not configured. Please set ACCESS_TOKEN environment variable.',
          type: 'authentication_error',
          code: 'remote_access_disabled'
        }
      })
    }
  }
  
  // Validate token
  if (allowedTokens.includes(token)) {
    console.log(`[Auth] Valid ${authType} token provided from ${clientIp}`)
    return next()
  }
  
  console.log(`[Auth] Invalid token from ${clientIp}`)
  
  const isClaudeEndpoint = req.path.includes('/v1/messages')
  
  if (isClaudeEndpoint) {
    return res.status(401).json({
      type: 'error',
      error: {
        type: 'authentication_error',
        message: 'Invalid API key.'
      }
    })
  } else {
    return res.status(401).json({
      error: {
        message: 'Invalid access token.',
        type: 'authentication_error',
        code: 'invalid_token'
      }
    })
  }
}
