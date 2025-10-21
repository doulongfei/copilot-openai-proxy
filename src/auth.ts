import { Request, Response, NextFunction } from 'express'

/**
 * Authentication middleware for API endpoints
 * - Allows localhost access without authentication
 * - Requires Bearer token authentication for remote access
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
  
  // For remote access, require authentication
  const authHeader = req.headers.authorization
  
  if (!authHeader) {
    console.log(`[Auth] No authorization header from ${clientIp}`)
    return res.status(401).json({
      error: {
        message: 'Authorization required. Please provide a valid Bearer token.',
        type: 'authentication_error',
        code: 'missing_authorization'
      }
    })
  }
  
  // Check Bearer token format
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i)
  if (!tokenMatch) {
    console.log(`[Auth] Invalid authorization format from ${clientIp}`)
    return res.status(401).json({
      error: {
        message: 'Invalid authorization format. Use: Authorization: Bearer <token>',
        type: 'authentication_error',
        code: 'invalid_authorization_format'
      }
    })
  }
  
  const token = tokenMatch[1]
  
  // Get allowed tokens from environment variable
  const allowedTokens = process.env.ACCESS_TOKEN 
    ? process.env.ACCESS_TOKEN.split(',').map(t => t.trim())
    : []
  
  // If no tokens configured, reject remote access
  if (allowedTokens.length === 0) {
    console.log(`[Auth] No access tokens configured, rejecting remote access from ${clientIp}`)
    return res.status(401).json({
      error: {
        message: 'Remote access is not configured. Please set ACCESS_TOKEN environment variable.',
        type: 'authentication_error',
        code: 'remote_access_disabled'
      }
    })
  }
  
  // Validate token
  if (allowedTokens.includes(token)) {
    console.log(`[Auth] Valid token provided from ${clientIp}`)
    return next()
  }
  
  console.log(`[Auth] Invalid token from ${clientIp}`)
  return res.status(401).json({
    error: {
      message: 'Invalid access token.',
      type: 'authentication_error',
      code: 'invalid_token'
    }
  })
}
