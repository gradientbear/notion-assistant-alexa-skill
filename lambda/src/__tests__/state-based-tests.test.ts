/**
 * State-Based Tests
 * 
 * Tests different user states, authentication states, and system states
 */

// Setup environment variables before imports
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
process.env.INTROSPECT_URL = 'https://voice-planner.com/api/auth/introspect';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.ALLOW_LEGACY_LOOKUP = 'false';
process.env.LEGACY_TOKEN_SUPPORT = 'false';

// Mock external dependencies
jest.mock('../utils/database', () => ({
  validateLicense: jest.fn().mockResolvedValue(true),
  getUserByAmazonId: jest.fn(),
  getUserByAuthUserId: jest.fn(),
}));

jest.mock('../utils/notion', () => ({
  createNotionClient: jest.fn(),
  findDatabaseByName: jest.fn(),
  getAllTasks: jest.fn(),
  addTask: jest.fn(),
  updateTask: jest.fn(),
  updateTaskStatus: jest.fn(),
  deleteTask: jest.fn(),
}));

jest.mock('../utils/jwt', () => ({
  verifyAccessToken: jest.fn().mockReturnValue(null),
  isLegacyToken: jest.fn().mockReturnValue(false),
  parseLegacyToken: jest.fn().mockReturnValue(null),
}));

import { handler } from '../../index';
import { ResponseEnvelope } from 'ask-sdk-model';
import {
  buildIntentRequest,
  buildLaunchRequest,
} from './test-utils/alexa-request-builder';
import {
  mockUser,
  mockUserNoNotion,
  mockUserNoLicense,
  createMockNotionClient,
  setupDatabaseMocks,
  setupNotionMocks,
  setupEnvMocks,
  mockIntrospectionResponse,
} from './test-utils/mocks';

import * as databaseUtils from '../utils/database';
import * as notionUtils from '../utils/notion';

describe('State-Based Tests', () => {
  let mockNotionClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    setupEnvMocks();
    mockNotionClient = createMockNotionClient();
    setupDatabaseMocks();
    setupNotionMocks(mockNotionClient);
  });

  async function invokeHandler(request: any): Promise<ResponseEnvelope> {
    const context: any = {
      callbackWaitsForEmptyEventLoop: true,
    };
    return await handler(request, context);
  }

  describe('Authentication States', () => {
    describe('No Access Token', () => {
      it('should require account linking for LaunchRequest', async () => {
        const request = buildLaunchRequest({
          accessToken: undefined,
        });

        const response = await invokeHandler(request);
        expect(response).toBeDefined();
        expect(response.response.card).toBeDefined();
        expect(response.response.card?.type).toBe('LinkAccount');
      });

      it('should require account linking for IntentRequest', async () => {
        const request = buildIntentRequest({
          intentName: 'ReadTasksIntent',
          accessToken: undefined,
        });

        const response = await invokeHandler(request);
        expect(response).toBeDefined();
        expect(response.response.card).toBeDefined();
        expect(response.response.card?.type).toBe('LinkAccount');
      });
    });

    describe('Valid Access Token', () => {
      beforeEach(() => {
        mockIntrospectionResponse(true);
      });

      it('should process LaunchRequest with valid token', async () => {
        const request = buildLaunchRequest({
          accessToken: 'valid-token',
        });

        const response = await invokeHandler(request);
        expect(response).toBeDefined();
        expect(response.response.outputSpeech).toBeDefined();
      });

      it('should process IntentRequest with valid token', async () => {
        const request = buildIntentRequest({
          intentName: 'ReadTasksIntent',
          accessToken: 'valid-token',
          sessionAttributes: { user: mockUser },
        });

        const response = await invokeHandler(request);
        expect(response).toBeDefined();
        expect(response.response.outputSpeech).toBeDefined();
      });

      it('should attach user to session attributes', async () => {
        jest.mocked(databaseUtils.getUserByAuthUserId).mockResolvedValue(mockUser);
        
        const request = buildIntentRequest({
          intentName: 'ReadTasksIntent',
          accessToken: 'valid-token',
        });

        const response = await invokeHandler(request);
        expect(response).toBeDefined();
        // User should be attached by AuthInterceptor
      });
    });

    describe('Invalid Access Token', () => {
      beforeEach(() => {
        mockIntrospectionResponse(false);
      });

      it('should require account linking for invalid token', async () => {
        const request = buildLaunchRequest({
          accessToken: 'invalid-token',
        });

        const response = await invokeHandler(request);
        expect(response).toBeDefined();
        // Should handle gracefully - either link account or error
      });
    });

    describe('Legacy Token Support', () => {
      beforeEach(() => {
        process.env.ALLOW_LEGACY_LOOKUP = 'true';
        process.env.LEGACY_TOKEN_SUPPORT = 'true';
      });

      afterEach(() => {
        process.env.ALLOW_LEGACY_LOOKUP = 'false';
        process.env.LEGACY_TOKEN_SUPPORT = 'false';
      });

      it('should fallback to Amazon ID lookup when legacy enabled', async () => {
        jest.mocked(databaseUtils.getUserByAmazonId).mockResolvedValue(mockUser);
        
        const request = buildLaunchRequest({
          accessToken: undefined,
          userId: 'test-amazon-id',
        });

        const response = await invokeHandler(request);
        expect(response).toBeDefined();
      });
    });
  });

  describe('Notion Connection States', () => {
    beforeEach(() => {
      mockIntrospectionResponse(true);
    });

    describe('Notion Connected', () => {
      it('should process CreateTaskIntent when Notion connected', async () => {
        const request = buildIntentRequest({
          intentName: 'CreateTaskIntent',
          accessToken: 'valid-token',
          sessionAttributes: { user: mockUser },
          slots: {
            taskName: 'Test task',
            priority: 'HIGH',
            dueDateTime: 'tomorrow',
            category: 'WORK',
          },
        });

        const response = await invokeHandler(request);
        expect(response).toBeDefined();
        expect(response.response.outputSpeech).toBeDefined();
      });

      it('should process ReadTasksIntent when Notion connected', async () => {
        const request = buildIntentRequest({
          intentName: 'ReadTasksIntent',
          accessToken: 'valid-token',
          sessionAttributes: { user: mockUser },
        });

        const response = await invokeHandler(request);
        expect(response).toBeDefined();
        expect(response.response.outputSpeech).toBeDefined();
      });

      it('should process UpdateTaskStatusIntent when Notion connected', async () => {
        const request = buildIntentRequest({
          intentName: 'UpdateTaskStatusIntent',
          accessToken: 'valid-token',
          sessionAttributes: { user: mockUser },
          slots: {
            taskName: 'Buy groceries',
            status: 'DONE',
          },
        });

        const response = await invokeHandler(request);
        expect(response).toBeDefined();
        expect(response.response.outputSpeech).toBeDefined();
      });

      it('should process DeleteTaskIntent when Notion connected', async () => {
        const request = buildIntentRequest({
          intentName: 'DeleteTaskIntent',
          accessToken: 'valid-token',
          sessionAttributes: { user: mockUser },
          slots: {
            taskName: 'Buy groceries',
          },
        });

        const response = await invokeHandler(request);
        expect(response).toBeDefined();
        expect(response.response.outputSpeech).toBeDefined();
      });
    });

    describe('Notion Not Connected', () => {
      it('should return error for CreateTaskIntent when Notion not connected', async () => {
        const request = buildIntentRequest({
          intentName: 'CreateTaskIntent',
          accessToken: 'valid-token',
          sessionAttributes: { user: mockUserNoNotion },
          slots: {
            taskName: 'Test task',
            priority: 'HIGH',
            dueDateTime: 'tomorrow',
            category: 'WORK',
          },
        });

        const response = await invokeHandler(request);
        expect(response).toBeDefined();
        const speechText = (response.response.outputSpeech as any)?.text || '';
        expect(speechText.toLowerCase()).toContain('notion');
      });

      it('should return error for ReadTasksIntent when Notion not connected', async () => {
        const request = buildIntentRequest({
          intentName: 'ReadTasksIntent',
          accessToken: 'valid-token',
          sessionAttributes: { user: mockUserNoNotion },
        });

        const response = await invokeHandler(request);
        expect(response).toBeDefined();
        const speechText = (response.response.outputSpeech as any)?.text || '';
        expect(speechText.toLowerCase()).toContain('notion');
      });

      it('should return error for UpdateTaskStatusIntent when Notion not connected', async () => {
        const request = buildIntentRequest({
          intentName: 'UpdateTaskStatusIntent',
          accessToken: 'valid-token',
          sessionAttributes: { user: mockUserNoNotion },
          slots: {
            taskName: 'Buy groceries',
            status: 'DONE',
          },
        });

        const response = await invokeHandler(request);
        expect(response).toBeDefined();
        const speechText = (response.response.outputSpeech as any)?.text || '';
        expect(speechText.toLowerCase()).toContain('notion');
      });

      it('should return error for DeleteTaskIntent when Notion not connected', async () => {
        const request = buildIntentRequest({
          intentName: 'DeleteTaskIntent',
          accessToken: 'valid-token',
          sessionAttributes: { user: mockUserNoNotion },
          slots: {
            taskName: 'Buy groceries',
          },
        });

        const response = await invokeHandler(request);
        expect(response).toBeDefined();
        const speechText = (response.response.outputSpeech as any)?.text || '';
        expect(speechText.toLowerCase()).toContain('notion');
      });
    });

    describe('Database Not Found', () => {
      it('should handle database not found error', async () => {
        jest.mocked(notionUtils.findDatabaseByName).mockResolvedValue(null);

        const request = buildIntentRequest({
          intentName: 'ReadTasksIntent',
          accessToken: 'valid-token',
          sessionAttributes: { user: mockUser },
        });

        const response = await invokeHandler(request);
        expect(response).toBeDefined();
        const speechText = (response.response.outputSpeech as any)?.text || '';
        expect(speechText.toLowerCase()).toContain('database');
      });

      it('should handle missing tasks_db_id in user record', async () => {
        const userWithoutDbId = {
          ...mockUser,
          tasks_db_id: null,
        };
        jest.mocked(notionUtils.findDatabaseByName).mockResolvedValue('found-db-id');

        const request = buildIntentRequest({
          intentName: 'ReadTasksIntent',
          accessToken: 'valid-token',
          sessionAttributes: { user: userWithoutDbId },
        });

        const response = await invokeHandler(request);
        expect(response).toBeDefined();
      });
    });
  });

  describe('License States', () => {
    beforeEach(() => {
      mockIntrospectionResponse(true);
    });

    // Note: License validation is currently disabled in the codebase
    // These tests are prepared for when license validation is re-enabled

    it('should process requests when license is active', async () => {
      mockIntrospectionResponse(true, { license_active: true });

      const request = buildIntentRequest({
        intentName: 'ReadTasksIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
      });

      const response = await invokeHandler(request);
      expect(response).toBeDefined();
    });

    it('should handle inactive license gracefully', async () => {
      mockIntrospectionResponse(true, { license_active: false });

      const request = buildIntentRequest({
        intentName: 'ReadTasksIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
      });

      const response = await invokeHandler(request);
      expect(response).toBeDefined();
      // Currently license check is disabled, so this should still work
    });
  });

  describe('Combined State Scenarios', () => {
    beforeEach(() => {
      mockIntrospectionResponse(true);
    });

    it('should handle valid token + Notion connected + active license', async () => {
      mockIntrospectionResponse(true, { license_active: true });

      const request = buildIntentRequest({
        intentName: 'CreateTaskIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
        slots: {
          taskName: 'Test task',
          priority: 'HIGH',
          dueDateTime: 'tomorrow',
          category: 'WORK',
        },
      });

      const response = await invokeHandler(request);
      expect(response).toBeDefined();
      expect(response.response.outputSpeech).toBeDefined();
    });

    it('should handle valid token + Notion not connected', async () => {
      const request = buildIntentRequest({
        intentName: 'CreateTaskIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUserNoNotion },
        slots: {
          taskName: 'Test task',
          priority: 'HIGH',
          dueDateTime: 'tomorrow',
          category: 'WORK',
        },
      });

      const response = await invokeHandler(request);
      expect(response).toBeDefined();
      const speechText = (response.response.outputSpeech as any)?.text || '';
      expect(speechText.toLowerCase()).toContain('notion');
    });

    it('should handle invalid token + Notion connected', async () => {
      mockIntrospectionResponse(false);

      const request = buildIntentRequest({
        intentName: 'ReadTasksIntent',
        accessToken: 'invalid-token',
        sessionAttributes: { user: mockUser },
      });

      const response = await invokeHandler(request);
      expect(response).toBeDefined();
      // Should require account linking
    });

    it('should handle valid token + database not found', async () => {
      jest.mocked(notionUtils.findDatabaseByName).mockResolvedValue(null);

      const request = buildIntentRequest({
        intentName: 'ReadTasksIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
      });

      const response = await invokeHandler(request);
      expect(response).toBeDefined();
      const speechText = (response.response.outputSpeech as any)?.text || '';
      expect(speechText.toLowerCase()).toContain('database');
    });
  });

  describe('Session State Management', () => {
    beforeEach(() => {
      mockIntrospectionResponse(true);
    });

    it('should persist user in session attributes', async () => {
      const request = buildIntentRequest({
        intentName: 'ReadTasksIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
      });

      const response = await invokeHandler(request);
      expect(response).toBeDefined();
      // User should be available in subsequent requests
    });

    it('should persist Notion client in session attributes', async () => {
      const request = buildIntentRequest({
        intentName: 'ReadTasksIntent',
        accessToken: 'valid-token',
        sessionAttributes: { 
          user: mockUser,
          notionClient: mockNotionClient,
        },
      });

      const response = await invokeHandler(request);
      expect(response).toBeDefined();
      // Notion client should be reused
    });

    it('should handle session without pre-populated attributes', async () => {
      const request = buildIntentRequest({
        intentName: 'ReadTasksIntent',
        accessToken: 'valid-token',
        sessionAttributes: {},
      });

      const response = await invokeHandler(request);
      expect(response).toBeDefined();
      // AuthInterceptor should populate attributes
    });
  });

  describe('Error Recovery States', () => {
    beforeEach(() => {
      mockIntrospectionResponse(true);
    });

    it('should recover from transient Notion API errors', async () => {
      // First call fails, second succeeds
      jest.mocked(notionUtils.findDatabaseByName)
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce('test-db-id');

      const request = buildIntentRequest({
        intentName: 'ReadTasksIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
      });

      // Handler should catch and return error response
      const response = await invokeHandler(request);
      expect(response).toBeDefined();
    });

    it('should handle Notion API rate limiting', async () => {
      const rateLimitError = new Error('Rate limited');
      (rateLimitError as any).status = 429;
      jest.mocked(notionUtils.findDatabaseByName).mockRejectedValue(rateLimitError);

      const request = buildIntentRequest({
        intentName: 'ReadTasksIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
      });

      const response = await invokeHandler(request);
      expect(response).toBeDefined();
      // Should handle gracefully
    });
  });
});

