import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || '';
const JWT_EXPIRES_IN = parseInt(process.env.JWT_EXPIRES_IN || '3600', 10);
const WEBSITE_JWT_EXPIRES_IN = parseInt(process.env.WEBSITE_JWT_EXPIRES_IN || '3600', 10); // 1 hour default
const APP_ISS = process.env.APP_ISS || 'https://voice-planner-murex.vercel.app';

/**
 * Validates that JWT_SECRET is set (for runtime, not build time)
 */
function requireJwtSecret(): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return JWT_SECRET;
}

export interface JWTPayload {
  iss: string; // Issuer
  sub: string; // Subject (user ID - Supabase auth_user_id)
  email: string;
  iat: number; // Issued at
  exp: number; // Expiration
  scope: string; // e.g., "alexa"
  notion_db_id?: string; // Optional: tasks_db_id
  amazon_account_id?: string; // Optional: for legacy compatibility
  type?: string; // Token type: 'website_session' or 'alexa'
}

export interface WebsiteJWTPayload {
  iss: string; // Issuer
  sub: string; // Subject (user ID - Supabase auth_user_id)
  email: string;
  iat: number; // Issued at
  exp: number; // Expiration (1 hour)
  type: 'website_session';
}

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

/**
 * Sign a JWT access token
 */
export function signAccessToken(payload: {
  userId: string; // Supabase auth_user_id
  email: string;
  scope?: string;
  notionDbId?: string;
  amazonAccountId?: string;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const jwtPayload: JWTPayload = {
    iss: APP_ISS,
    sub: payload.userId,
    email: payload.email,
    iat: now,
    exp: now + JWT_EXPIRES_IN,
    scope: payload.scope || 'alexa',
    notion_db_id: payload.notionDbId,
    amazon_account_id: payload.amazonAccountId,
  };

  return jwt.sign(jwtPayload, requireJwtSecret(), {
    algorithm: 'HS256',
  });
}

/**
 * Verify and decode a JWT access token
 */
export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, requireJwtSecret(), {
      algorithms: ['HS256'],
    }) as JWTPayload;
    return decoded;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      console.warn('[JWT] Token expired:', error.message);
    } else if (error.name === 'JsonWebTokenError') {
      console.warn('[JWT] Invalid token:', error.message);
    } else {
      console.error('[JWT] Verification error:', error);
    }
    return null;
  }
}

/**
 * Check if a token is a legacy base64 token
 */
export function isLegacyToken(token: string): boolean {
  try {
    // Legacy tokens are base64-encoded JSON
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);
    // Legacy tokens have these fields
    return (
      typeof parsed === 'object' &&
      (parsed.amazon_account_id || parsed.email || parsed.timestamp) &&
      !parsed.iss // JWTs have 'iss', legacy tokens don't
    );
  } catch {
    return false;
  }
}

/**
 * Parse a legacy base64 token
 */
export function parseLegacyToken(token: string): {
  amazon_account_id?: string;
  email?: string;
  timestamp?: number;
} | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Sign a website JWT token for website sessions
 * 1 hour expiration, stateless
 */
export function signWebsiteToken(payload: {
  userId: string; // Supabase auth_user_id
  email: string;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const jwtPayload: WebsiteJWTPayload = {
    iss: APP_ISS,
    sub: payload.userId,
    email: payload.email,
    iat: now,
    exp: now + WEBSITE_JWT_EXPIRES_IN,
    type: 'website_session',
  };

  return jwt.sign(jwtPayload, requireJwtSecret(), {
    algorithm: 'HS256',
  });
}

/**
 * Verify and decode a website JWT token
 */
export function verifyWebsiteToken(token: string): WebsiteJWTPayload | null {
  try {
    const decoded = jwt.verify(token, requireJwtSecret(), {
      algorithms: ['HS256'],
    }) as WebsiteJWTPayload;
    
    // Verify it's a website session token
    if (decoded.type !== 'website_session') {
      console.warn('[JWT] Token is not a website session token');
      return null;
    }
    
    return decoded;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      console.warn('[JWT] Website token expired:', error.message);
    } else if (error.name === 'JsonWebTokenError') {
      console.warn('[JWT] Invalid website token:', error.message);
    } else {
      console.error('[JWT] Website token verification error:', error);
    }
    return null;
  }
}

/**
 * Issue website JWT and refresh token
 * Returns both tokens for the client to store
 * Note: This function must be called from a server context (API route)
 */
export async function issueWebsiteTokens(
  userId: string, // users.id (UUID)
  authUserId: string, // Supabase auth_user_id
  email: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  // Dynamic import to avoid circular dependencies
  const crypto = await import('crypto');
  const { createServerClient } = await import('./supabase');
  
  // Generate access token (1 hour)
  const accessToken = signWebsiteToken({
    userId: authUserId,
    email,
  });

  // Generate refresh token (7 days, opaque)
  const refreshToken = crypto.randomBytes(32).toString('base64url');
  const REFRESH_TOKEN_EXPIRES_IN = 7 * 24 * 60 * 60; // 7 days
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN * 1000);

  // Store refresh token in database
  const supabase = createServerClient();
  const { error: storeError } = await supabase
    .from('website_refresh_tokens')
    .insert({
      token: refreshToken,
      user_id: userId,
      expires_at: expiresAt.toISOString(),
      revoked: false,
    });

  if (storeError) {
    console.error('[JWT] Error storing refresh token:', storeError);
    throw new Error('Failed to store refresh token');
  }

  return {
    accessToken,
    refreshToken,
    expiresIn: WEBSITE_JWT_EXPIRES_IN,
  };
}

