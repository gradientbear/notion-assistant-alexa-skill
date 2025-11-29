import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || '';
const JWT_EXPIRES_IN = parseInt(process.env.JWT_EXPIRES_IN || '3600', 10);
const APP_ISS = process.env.APP_ISS || 'https://notion-data-user.vercel.app';

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

