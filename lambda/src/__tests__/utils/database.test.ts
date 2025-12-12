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
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: { status: 'active' },
        error: null,
      });
      
      const mockEq = jest.fn().mockReturnValue({
        maybeSingle: mockMaybeSingle,
      });
      
      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });
      
      mockFrom.mockReturnValue({
        select: mockSelect,
      });

      const result = await validateLicense('TEST-LICENSE-001');
      expect(result).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('licenses');
      expect(mockSelect).toHaveBeenCalledWith('status');
      expect(mockEq).toHaveBeenCalledWith('stripe_payment_intent_id', 'TEST-LICENSE-001');
    });

    it('should return false for inactive license', async () => {
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: { status: 'inactive' },
        error: null,
      });
      
      const mockEq = jest.fn().mockReturnValue({
        maybeSingle: mockMaybeSingle,
      });
      
      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });
      
      mockFrom.mockReturnValue({
        select: mockSelect,
      });

      const result = await validateLicense('TEST-LICENSE-001');
      expect(result).toBe(false);
    });

    it('should return false for non-existent license', async () => {
      // First call (stripe_payment_intent_id) returns null
      const mockMaybeSingleFirst = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });
      
      // Second call (license_key fallback) also returns null
      const mockMaybeSingleFallback = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });
      
      // Create separate chains for each call
      const mockEqFirst = jest.fn().mockReturnValue({
        maybeSingle: mockMaybeSingleFirst,
      });
      
      const mockEqFallback = jest.fn().mockReturnValue({
        maybeSingle: mockMaybeSingleFallback,
      });
      
      const mockSelect = jest.fn()
        .mockReturnValueOnce({
          eq: mockEqFirst,
        })
        .mockReturnValueOnce({
          eq: mockEqFallback,
        });
      
      mockFrom.mockReturnValue({
        select: mockSelect,
      });

      const result = await validateLicense('INVALID-LICENSE');
      expect(result).toBe(false);
      // Should try stripe_payment_intent_id first, then license_key
      expect(mockFrom).toHaveBeenCalledTimes(2);
    });
  });

  describe('getUserByAmazonId', () => {
    // Mock fetch for direct REST API calls
    const originalFetch = global.fetch;
    
    beforeEach(() => {
      global.fetch = jest.fn();
      // Reset mockFrom for each test
      mockFrom.mockClear();
    });
    
    afterEach(() => {
      global.fetch = originalFetch;
    });

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

      // Mock the direct REST API call (first attempt)
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue([mockUser]),
      });

      const result = await getUserByAmazonId('amzn1.test');
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      // Mock the direct REST API call returning 404
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await getUserByAmazonId('amzn1.invalid');
      expect(result).toBeNull();
    });

    it('should fallback to Supabase client when direct API fails', async () => {
      const mockUser = {
        id: '123',
        amazon_account_id: 'amzn1.test',
        email: 'test@example.com',
        license_key: 'TEST-LICENSE-001',
        notion_token: 'token123',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      };

      // Mock fetch to fail (simulating direct API failure)
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      // Mock Supabase client fallback
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: mockUser,
        error: null,
      });
      
      const mockEq = jest.fn().mockReturnValue({
        maybeSingle: mockMaybeSingle,
      });
      
      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });
      
      mockFrom.mockReturnValue({
        select: mockSelect,
      });

      const result = await getUserByAmazonId('amzn1.test');
      expect(result).toEqual(mockUser);
      expect(mockFrom).toHaveBeenCalledWith('users');
    });
  });
});

