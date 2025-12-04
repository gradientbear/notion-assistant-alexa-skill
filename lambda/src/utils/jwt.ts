// JWT utilities for Lambda (lightweight, no external dependencies)
// Uses Node.js crypto for HMAC verification

import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || '';

export interface JWTPayload {
  iss: string;
  sub: string;
  email: string;
  iat: number;
  exp: number;
  scope: string;
  notion_db_id?: string;
  amazon_account_id?: string;
}

/**
 * Base64 URL decode
 */
function base64UrlDecode(str: string): Buffer {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad) {
    base64 += '='.repeat(4 - pad);
  }
  return Buffer.from(base64, 'base64');
}

/**
 * Verify JWT token signature (HS256)
 * Note: This only works for JWT tokens. Opaque tokens must be validated via introspection endpoint.
 */
export function verifyAccessToken(token: string): JWTPayload | null {
  if (!JWT_SECRET) {
    console.warn('[JWT] JWT_SECRET not set, cannot verify tokens locally');
    return null;
  }

  try {
    const parts = token.split('.');
    // JWT tokens have exactly 3 parts (header.payload.signature)
    // Opaque tokens are random strings without dots, so they won't pass this check
    if (parts.length !== 3) {
      return null;
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // Verify signature
    const signature = base64UrlDecode(signatureB64);
    const data = `${headerB64}.${payloadB64}`;
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(data)
      .digest();

    if (!crypto.timingSafeEqual(signature, expectedSignature)) {
      console.warn('[JWT] Signature verification failed');
      return null;
    }

    // Decode payload
    const payloadJson = base64UrlDecode(payloadB64).toString('utf-8');
    const payload = JSON.parse(payloadJson) as JWTPayload;

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      console.warn('[JWT] Token expired');
      return null;
    }

    return payload;
  } catch (error: any) {
    console.error('[JWT] Verification error:', error.message);
    return null;
  }
}

/**
 * Check if a token is a legacy base64 token
 */
export function isLegacyToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);
    return (
      typeof parsed === 'object' &&
      (parsed.amazon_account_id || parsed.email || parsed.timestamp) &&
      !parsed.iss
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

