// Mock environment variables before importing
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-key';

jest.mock('../../utils/database', () => {
  const actual = jest.requireActual('../../utils/database');
  return {
    ...actual,
    supabase: {
      from: jest.fn(),
    },
  };
});

import { validateLicense, getUserByAmazonId } from '../../utils/database';
import { supabase } from '../../utils/database';
  ...jest.requireActual('../../utils/database'),
  supabase: {
    from: jest.fn(),
  },
}));

describe('Database Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateLicense', () => {
    it('should return true for active license', async () => {
      const mockFrom = supabase.from as jest.Mock;
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
      const mockFrom = supabase.from as jest.Mock;
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
      const mockFrom = supabase.from as jest.Mock;
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

      const mockFrom = supabase.from as jest.Mock;
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
      const mockFrom = supabase.from as jest.Mock;
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

