// Mock environment variables before importing
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-key';

// Mock Supabase client before database module loads
const mockFrom = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: mockFrom,
  })),
}));

import { validateLicense, getUserByAmazonId } from '../../utils/database';

describe('Database Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateLicense', () => {
    it('should return true for active license', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { status: 'active' },
              error: null,
            }),
          }),
        }),
      });

      const result = await validateLicense('TEST-LICENSE-001');
      expect(result).toBe(true);
    });

    it('should return false for inactive license', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { status: 'inactive' },
              error: null,
            }),
          }),
        }),
      });

      const result = await validateLicense('TEST-LICENSE-001');
      expect(result).toBe(false);
    });

    it('should return false for non-existent license', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      });

      const result = await validateLicense('INVALID-LICENSE');
      expect(result).toBe(false);
    });
  });

  describe('getUserByAmazonId', () => {
    it('should return user when found', async () => {
      const mockUser = {
        id: '123',
        amazon_account_id: 'amzn1.test',
        email: 'test@example.com',
        license_key: 'TEST-LICENSE-001',
        notion_token: 'token123',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      };

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockUser,
              error: null,
            }),
          }),
        }),
      });

      const result = await getUserByAmazonId('amzn1.test');
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      });

      const result = await getUserByAmazonId('amzn1.invalid');
      expect(result).toBeNull();
    });
  });
});

