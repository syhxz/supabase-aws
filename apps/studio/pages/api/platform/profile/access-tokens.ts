import { NextApiRequest, NextApiResponse } from 'next'

import apiWrapper from 'lib/api/apiWrapper'
import {
  accessTokenStorage,
  generateAccessToken,
  validateTokenName,
  validateTokenExpiration,
  isTokenExpired,
  createAccessTokenRecord,
  tokenRecordToResponse,
} from 'lib/self-hosted-api'
import type {
  AccessTokensResponse,
  CreateAccessTokenRequest,
  CreateAccessTokenResponse,
  ErrorResponse,
} from 'lib/self-hosted-api'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGetAccessTokens(req, res)
    case 'POST':
      return handleCreateAccessToken(req, res)
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      res.status(405).json({ 
        data: null, 
        error: { message: `Method ${method} Not Allowed` } 
      } as ErrorResponse)
  }
}

/**
 * GET /api/platform/profile/access-tokens
 * Returns list of access tokens for the user (excluding actual token values)
 */
const handleGetAccessTokens = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    // Load all tokens from storage
    const allTokens = await accessTokenStorage.loadTokens()
    
    // Filter out expired tokens and convert to response format
    const activeTokens = allTokens
      .filter(token => !isTokenExpired(token))
      .map(token => tokenRecordToResponse(token))
    
    const response: AccessTokensResponse = {
      tokens: activeTokens,
    }
    
    return res.status(200).json(response)
  } catch (error) {
    console.error('Error loading access tokens:', error)
    return res.status(500).json({
      data: null,
      error: {
        message: 'Failed to load access tokens',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    } as ErrorResponse)
  }
}

/**
 * POST /api/platform/profile/access-tokens
 * Creates a new access token
 */
const handleCreateAccessToken = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const requestBody = req.body as CreateAccessTokenRequest
    
    // Validate required fields
    if (!requestBody.name) {
      return res.status(400).json({
        data: null,
        error: {
          message: 'Token name is required',
          code: 'MISSING_TOKEN_NAME',
        },
      } as ErrorResponse)
    }
    
    // Validate token name format
    if (!validateTokenName(requestBody.name)) {
      return res.status(400).json({
        data: null,
        error: {
          message: 'Invalid token name format. Name must be 1-50 characters, alphanumeric with spaces, hyphens, or underscores.',
          code: 'INVALID_TOKEN_NAME',
        },
      } as ErrorResponse)
    }
    
    // Validate expiration date if provided
    if (requestBody.expires_at && !validateTokenExpiration(requestBody.expires_at)) {
      return res.status(400).json({
        data: null,
        error: {
          message: 'Invalid expiration date. Date must be in the future.',
          code: 'INVALID_EXPIRATION_DATE',
        },
      } as ErrorResponse)
    }
    
    // Check for duplicate token names
    const existingTokens = await accessTokenStorage.loadTokens()
    const duplicateName = existingTokens.some(
      token => token.name.toLowerCase() === requestBody.name.trim().toLowerCase() && !isTokenExpired(token)
    )
    
    if (duplicateName) {
      return res.status(409).json({
        data: null,
        error: {
          message: 'A token with this name already exists',
          code: 'DUPLICATE_TOKEN_NAME',
        },
      } as ErrorResponse)
    }
    
    // Check token creation limit (max 10 active tokens per user)
    const activeTokens = existingTokens.filter(token => !isTokenExpired(token))
    if (activeTokens.length >= 10) {
      return res.status(429).json({
        data: null,
        error: {
          message: 'Maximum number of active tokens reached (10). Please delete some tokens before creating new ones.',
          code: 'TOKEN_LIMIT_EXCEEDED',
        },
      } as ErrorResponse)
    }
    
    // Generate new token
    const token = generateAccessToken()
    const tokenRecord = createAccessTokenRecord(requestBody, token)
    
    // Save to storage
    await accessTokenStorage.addToken(tokenRecord)
    
    // Return response with token (only time the actual token is returned)
    const response: CreateAccessTokenResponse = {
      ...tokenRecordToResponse(tokenRecord),
      token, // Include actual token only on creation
    }
    
    return res.status(201).json(response)
  } catch (error) {
    console.error('Error creating access token:', error)
    return res.status(500).json({
      data: null,
      error: {
        message: 'Failed to create access token',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    } as ErrorResponse)
  }
}