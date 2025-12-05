// Mock environment variables before importing
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-key';

// Mock database and notion modules
jest.mock('../../utils/database', () => ({
  validateLicense: jest.fn().mockResolvedValue(true),
  getUserByAmazonId: jest.fn().mockResolvedValue({
    id: '123',
    amazon_account_id: 'test-user-id',
    email: 'test@example.com',
    license_key: 'TEST-LICENSE',
    notion_token: 'test-token',
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  }),
}));

jest.mock('../../utils/notion', () => ({
  createNotionClient: jest.fn(() => ({})),
  findDatabaseByName: jest.fn().mockResolvedValue('db-id'),
  getTopPriorityTasks: jest.fn().mockResolvedValue([]),
}));

import { handler } from '../../index';
import { RequestEnvelope, ResponseEnvelope } from 'ask-sdk-model';

// Integration test for full Alexa request flow
describe('Alexa Skill Integration', () => {
  const createLaunchRequest = (): RequestEnvelope => ({
    version: '1.0',
    session: {
      new: true,
      sessionId: 'test-session',
      application: {
        applicationId: 'test-app-id',
      },
      user: {
        userId: 'test-user-id',
      },
    },
    context: {
      System: {
        application: {
          applicationId: 'test-app-id',
        },
        user: {
          userId: 'test-user-id',
        },
        device: {
          deviceId: 'test-device',
          supportedInterfaces: {},
        },
        apiEndpoint: 'https://api.amazonalexa.com',
        apiAccessToken: 'test-token',
      },
    },
    request: {
      type: 'LaunchRequest',
      requestId: 'test-request',
      timestamp: new Date().toISOString(),
      locale: 'en-US',
    },
  });

  it('should handle LaunchRequest', async () => {
    const request = createLaunchRequest();
    
    // Use Promise-based invocation (without callback)
    const response = await new Promise<ResponseEnvelope>((resolve, reject) => {
      handler(request, {} as any, (error: Error | null, result?: ResponseEnvelope) => {
        if (error) {
          reject(error);
        } else {
          resolve(result as ResponseEnvelope);
        }
      });
    });
    
    expect(response).toBeDefined();
    expect(response.version).toBe('1.0');
  });

  it('should handle IntentRequest', async () => {
    const request: RequestEnvelope = {
      ...createLaunchRequest(),
      request: {
        type: 'IntentRequest',
        requestId: 'test-intent-request',
        timestamp: new Date().toISOString(),
        locale: 'en-US',
        dialogState: 'COMPLETED',
        intent: {
          name: 'QueryTasksIntent',
          confirmationStatus: 'NONE',
        },
      },
    };

    const response = await new Promise<ResponseEnvelope>((resolve, reject) => {
      handler(request, {} as any, (error: Error | null, result?: ResponseEnvelope) => {
        if (error) {
          reject(error);
        } else {
          resolve(result as ResponseEnvelope);
        }
      });
    });
    
    expect(response).toBeDefined();
    expect(response.version).toBe('1.0');
  });
});

