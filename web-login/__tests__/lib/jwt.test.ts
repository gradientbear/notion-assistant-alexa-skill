import { signAccessToken, verifyAccessToken, isLegacyToken, parseLegacyToken } from '@/lib/jwt';

// Mock environment variables
process.env.JWT_SECRET = 'test-secret-key-min-32-characters-long';
process.env.JWT_EXPIRES_IN = '3600';
process.env.APP_ISS = 'https://test.example.com';

describe('JWT Utilities', () => {
  describe('signAccessToken', () => {
    it('should sign a valid JWT token', () => {
      const token = signAccessToken({
        userId: 'user-123',
        email: 'test@example.com',
        scope: 'alexa',
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include all claims in token', () => {
      const token = signAccessToken({
        userId: 'user-123',
        email: 'test@example.com',
        scope: 'alexa',
        notionDbId: 'notion-db-123',
        amazonAccountId: 'amazon-123',
      });

      const payload = verifyAccessToken(token);
      expect(payload).not.toBeNull();
      expect(payload?.sub).toBe('user-123');
      expect(payload?.email).toBe('test@example.com');
      expect(payload?.scope).toBe('alexa');
      expect(payload?.notion_db_id).toBe('notion-db-123');
      expect(payload?.amazon_account_id).toBe('amazon-123');
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid token', () => {
      const token = signAccessToken({
        userId: 'user-123',
        email: 'test@example.com',
      });

      const payload = verifyAccessToken(token);
      expect(payload).not.toBeNull();
      expect(payload?.sub).toBe('user-123');
      expect(payload?.email).toBe('test@example.com');
    });

    it('should reject an invalid token', () => {
      const payload = verifyAccessToken('invalid.token.here');
      expect(payload).toBeNull();
    });

    it('should reject an expired token', () => {
      // Create a token with very short expiration
      process.env.JWT_EXPIRES_IN = '1';
      const token = signAccessToken({
        userId: 'user-123',
        email: 'test@example.com',
      });

      // Wait for expiration
      return new Promise((resolve) => {
        setTimeout(() => {
          const payload = verifyAccessToken(token);
          expect(payload).toBeNull();
          process.env.JWT_EXPIRES_IN = '3600';
          resolve(undefined);
        }, 2000);
      });
    });

    it('should reject a tampered token', () => {
      const token = signAccessToken({
        userId: 'user-123',
        email: 'test@example.com',
      });

      // Tamper with the token
      const parts = token.split('.');
      parts[1] = Buffer.from(JSON.stringify({ sub: 'hacker' })).toString('base64url');
      const tamperedToken = parts.join('.');

      const payload = verifyAccessToken(tamperedToken);
      expect(payload).toBeNull();
    });
  });

  describe('isLegacyToken', () => {
    it('should detect legacy base64 tokens', () => {
      const legacyToken = Buffer.from(
        JSON.stringify({
          amazon_account_id: 'amazon-123',
          email: 'test@example.com',
          timestamp: Date.now(),
        })
      ).toString('base64');

      expect(isLegacyToken(legacyToken)).toBe(true);
    });

    it('should not detect JWT tokens as legacy', () => {
      const jwtToken = signAccessToken({
        userId: 'user-123',
        email: 'test@example.com',
      });

      expect(isLegacyToken(jwtToken)).toBe(false);
    });

    it('should not detect invalid base64 as legacy', () => {
      expect(isLegacyToken('not-base64')).toBe(false);
      expect(isLegacyToken('')).toBe(false);
    });
  });

  describe('parseLegacyToken', () => {
    it('should parse valid legacy tokens', () => {
      const data = {
        amazon_account_id: 'amazon-123',
        email: 'test@example.com',
        timestamp: Date.now(),
      };

      const legacyToken = Buffer.from(JSON.stringify(data)).toString('base64');
      const parsed = parseLegacyToken(legacyToken);

      expect(parsed).toEqual(data);
    });

    it('should return null for invalid tokens', () => {
      expect(parseLegacyToken('invalid')).toBeNull();
      expect(parseLegacyToken('')).toBeNull();
    });
  });
});

