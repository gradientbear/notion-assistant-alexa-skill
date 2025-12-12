/**
 * Edge Case Tests
 * 
 * Tests edge cases, invalid inputs, error conditions, and boundary scenarios
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
  slotValue,
  emptySlot,
} from './test-utils/alexa-request-builder';
import {
  mockUser,
  createMockNotionClient,
  setupDatabaseMocks,
  setupNotionMocks,
  setupEnvMocks,
  mockIntrospectionResponse,
} from './test-utils/mocks';

import * as notionUtils from '../utils/notion';

describe('Edge Case Tests', () => {
  let mockNotionClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    setupEnvMocks();
    mockNotionClient = createMockNotionClient();
    setupDatabaseMocks();
    setupNotionMocks(mockNotionClient);
    mockIntrospectionResponse(true);
  });

  async function invokeHandler(request: any): Promise<ResponseEnvelope> {
    const context: any = {
      callbackWaitsForEmptyEventLoop: true,
    };
    return await handler(request, context);
  }

  describe('Slot Value Edge Cases', () => {
    describe('Empty and Whitespace Values', () => {
      it('should handle empty string slot values', async () => {
        const request = buildIntentRequest({
          intentName: 'CreateTaskIntent',
          accessToken: 'valid-token',
          sessionAttributes: { user: mockUser },
          slots: {
            taskName: '',
            priority: 'HIGH',
            dueDateTime: 'tomorrow',
            category: 'WORK',
          },
        });

        const response = await invokeHandler(request);
        expect(response).toBeDefined();
        expect(response.response).toBeDefined();
      });

      it('should handle whitespace-only slot values', async () => {
        const request = buildIntentRequest({
          intentName: 'CreateTaskIntent',
          accessToken: 'valid-token',
          sessionAttributes: { user: mockUser },
          slots: {
            taskName: '   ',
            priority: 'HIGH',
            dueDateTime: 'tomorrow',
            category: 'WORK',
          },
        });

        const response = await invokeHandler(request);
        expect(response).toBeDefined();
      });

      it('should handle very long task names', async () => {
        const longTaskName = 'A'.repeat(1000);
        const request = buildIntentRequest({
          intentName: 'CreateTaskIntent',
          accessToken: 'valid-token',
          sessionAttributes: { user: mockUser },
          slots: {
            taskName: longTaskName,
            priority: 'HIGH',
            dueDateTime: 'tomorrow',
            category: 'WORK',
          },
        });

        const response = await invokeHandler(request);
        expect(response).toBeDefined();
      });
    });

    describe('Special Characters and Unicode', () => {
      it('should handle special characters in task names', async () => {
        const request = buildIntentRequest({
          intentName: 'CreateTaskIntent',
          accessToken: 'valid-token',
          sessionAttributes: { user: mockUser },
          slots: {
            taskName: 'Task with @#$%^&*() special chars',
            priority: 'HIGH',
            dueDateTime: 'tomorrow',
            category: 'WORK',
          },
        });

        const response = await invokeHandler(request);
        expect(response).toBeDefined();
      });

      it('should handle Unicode characters', async () => {
        const request = buildIntentRequest({
          intentName: 'CreateTaskIntent',
          accessToken: 'valid-token',
          sessionAttributes: { user: mockUser },
          slots: {
            taskName: 'Tâche avec caractères spéciaux 中文 🎉',
            priority: 'HIGH',
            dueDateTime: 'tomorrow',
            category: 'WORK',
          },
        });

        const response = await invokeHandler(request);
        expect(response).toBeDefined();
      });

      it('should handle emoji in task names', async () => {
        const request = buildIntentRequest({
          intentName: 'CreateTaskIntent',
          accessToken: 'valid-token',
          sessionAttributes: { user: mockUser },
          slots: {
            taskName: 'Buy groceries 🛒',
            priority: 'HIGH',
            dueDateTime: 'tomorrow',
            category: 'WORK',
          },
        });

        const response = await invokeHandler(request);
        expect(response).toBeDefined();
      });
    });

    describe('Invalid Slot Values', () => {
      it('should handle unknown priority values', async () => {
        const request = buildIntentRequest({
          intentName: 'CreateTaskIntent',
          accessToken: 'valid-token',
          sessionAttributes: { user: mockUser },
          slots: {
            taskName: 'Test task',
            priority: 'EXTREME',
            dueDateTime: 'tomorrow',
            category: 'WORK',
          },
        });

        const response = await invokeHandler(request);
        expect(response).toBeDefined();
      });

      it('should handle unknown category values', async () => {
        const request = buildIntentRequest({
          intentName: 'CreateTaskIntent',
          accessToken: 'valid-token',
          sessionAttributes: { user: mockUser },
          slots: {
            taskName: 'Test task',
            priority: 'HIGH',
            dueDateTime: 'tomorrow',
            category: 'SCHOOL',
          },
        });

        const response = await invokeHandler(request);
        expect(response).toBeDefined();
      });

      it('should handle invalid date formats', async () => {
        const invalidDates = [
          'not a date',
          '32nd of January',
          'yesterday',
          'never',
          'whenever',
        ];

        for (const date of invalidDates) {
          const request = buildIntentRequest({
            intentName: 'CreateTaskIntent',
            accessToken: 'valid-token',
            sessionAttributes: { user: mockUser },
            slots: {
              taskName: 'Test task',
              priority: 'HIGH',
              dueDateTime: date,
              category: 'WORK',
            },
          });

          const response = await invokeHandler(request);
          expect(response).toBeDefined();
        }
      });

      it('should handle past dates', async () => {
        const request = buildIntentRequest({
          intentName: 'CreateTaskIntent',
          accessToken: 'valid-token',
          sessionAttributes: { user: mockUser },
          slots: {
            taskName: 'Test task',
            priority: 'HIGH',
            dueDateTime: '2020-01-01',
            category: 'WORK',
          },
        });

        const response = await invokeHandler(request);
        expect(response).toBeDefined();
      });

      it('should handle far future dates', async () => {
        const request = buildIntentRequest({
          intentName: 'CreateTaskIntent',
          accessToken: 'valid-token',
          sessionAttributes: { user: mockUser },
          slots: {
            taskName: 'Test task',
            priority: 'HIGH',
            dueDateTime: '2099-12-31',
            category: 'WORK',
          },
        });

        const response = await invokeHandler(request);
        expect(response).toBeDefined();
      });
    });

    describe('Case Variations', () => {
      it('should handle lowercase priority values', async () => {
        const request = buildIntentRequest({
          intentName: 'CreateTaskIntent',
          accessToken: 'valid-token',
          sessionAttributes: { user: mockUser },
          slots: {
            taskName: 'Test task',
            priority: 'high',
            dueDateTime: 'tomorrow',
            category: 'WORK',
          },
        });

        const response = await invokeHandler(request);
        expect(response).toBeDefined();
      });

      it('should handle mixed case priority values', async () => {
        const request = buildIntentRequest({
          intentName: 'CreateTaskIntent',
          accessToken: 'valid-token',
          sessionAttributes: { user: mockUser },
          slots: {
            taskName: 'Test task',
            priority: 'HiGh',
            dueDateTime: 'tomorrow',
            category: 'WORK',
          },
        });

        const response = await invokeHandler(request);
        expect(response).toBeDefined();
      });

      it('should handle lowercase category values', async () => {
        const request = buildIntentRequest({
          intentName: 'CreateTaskIntent',
          accessToken: 'valid-token',
          sessionAttributes: { user: mockUser },
          slots: {
            taskName: 'Test task',
            priority: 'HIGH',
            dueDateTime: 'tomorrow',
            category: 'work',
          },
        });

        const response = await invokeHandler(request);
        expect(response).toBeDefined();
      });
    });
  });

  describe('Task Matching Edge Cases', () => {
    it('should handle exact task name match', async () => {
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
    });

    it('should handle partial task name match', async () => {
      const request = buildIntentRequest({
        intentName: 'DeleteTaskIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
        slots: {
          taskName: 'groceries',
        },
      });

      const response = await invokeHandler(request);
      expect(response).toBeDefined();
    });

    it('should handle task name with extra words', async () => {
      const request = buildIntentRequest({
        intentName: 'DeleteTaskIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
        slots: {
          taskName: 'the task buy groceries',
        },
      });

      const response = await invokeHandler(request);
      expect(response).toBeDefined();
    });

    it('should handle case-insensitive task matching', async () => {
      const request = buildIntentRequest({
        intentName: 'DeleteTaskIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
        slots: {
          taskName: 'BUY GROCERIES',
        },
      });

      const response = await invokeHandler(request);
      expect(response).toBeDefined();
    });

    it('should handle task not found gracefully', async () => {
      jest.mocked(notionUtils.getAllTasks).mockResolvedValue([]);

      const request = buildIntentRequest({
        intentName: 'DeleteTaskIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
        slots: {
          taskName: 'Non-existent task name',
        },
      });

      const response = await invokeHandler(request);
      expect(response).toBeDefined();
      const speechText = (response.response.outputSpeech as any)?.text || '';
      expect(speechText.toLowerCase()).toContain('not found');
    });
  });

  describe('Date Parsing Edge Cases', () => {
    const naturalLanguageDates = [
      'today',
      'tomorrow',
      'next week',
      'next Monday',
      'in 3 days',
      'in a week',
      'next month',
      'next year',
      'Monday',
      'Friday',
      'this weekend',
      'next weekend',
    ];

    naturalLanguageDates.forEach((date) => {
      it(`should parse natural language date: "${date}"`, async () => {
        const request = buildIntentRequest({
          intentName: 'CreateTaskIntent',
          accessToken: 'valid-token',
          sessionAttributes: { user: mockUser },
          slots: {
            taskName: 'Test task',
            priority: 'HIGH',
            dueDateTime: date,
            category: 'WORK',
          },
        });

        const response = await invokeHandler(request);
        expect(response).toBeDefined();
      });
    });

    it('should handle ISO date format', async () => {
      const request = buildIntentRequest({
        intentName: 'CreateTaskIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
        slots: {
          taskName: 'Test task',
          priority: 'HIGH',
          dueDateTime: '2024-12-25',
          category: 'WORK',
        },
      });

      const response = await invokeHandler(request);
      expect(response).toBeDefined();
    });

    it('should handle date with time', async () => {
      const request = buildIntentRequest({
        intentName: 'CreateTaskIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
        slots: {
          taskName: 'Test task',
          priority: 'HIGH',
          dueDateTime: 'tomorrow at 3pm',
          category: 'WORK',
        },
      });

      const response = await invokeHandler(request);
      expect(response).toBeDefined();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle Notion API 429 rate limit error', async () => {
      const error = new Error('Rate limited');
      (error as any).status = 429;
      jest.mocked(notionUtils.findDatabaseByName).mockRejectedValue(error);

      const request = buildIntentRequest({
        intentName: 'ReadTasksIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
      });

      const response = await invokeHandler(request);
      expect(response).toBeDefined();
    });

    it('should handle Notion API 500 error', async () => {
      const error = new Error('Internal server error');
      (error as any).status = 500;
      jest.mocked(notionUtils.findDatabaseByName).mockRejectedValue(error);

      const request = buildIntentRequest({
        intentName: 'ReadTasksIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
      });

      const response = await invokeHandler(request);
      expect(response).toBeDefined();
    });

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

    it('should handle network timeout', async () => {
      const error = new Error('Network timeout');
      (error as any).code = 'ETIMEDOUT';
      jest.mocked(notionUtils.findDatabaseByName).mockRejectedValue(error);

      const request = buildIntentRequest({
        intentName: 'ReadTasksIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
      });

      const response = await invokeHandler(request);
      expect(response).toBeDefined();
    });

    it('should handle invalid Notion response', async () => {
      jest.mocked(notionUtils.getAllTasks).mockResolvedValue(null as any);

      const request = buildIntentRequest({
        intentName: 'ReadTasksIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
      });

      const response = await invokeHandler(request);
      expect(response).toBeDefined();
    });
  });

  describe('Dialog State Edge Cases', () => {
    it('should handle dialog state STARTED', async () => {
      const request = buildIntentRequest({
        intentName: 'CreateTaskIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
        dialogState: 'STARTED',
        slots: {
          taskName: emptySlot(),
          priority: 'HIGH',
          dueDateTime: 'tomorrow',
          category: 'WORK',
        },
      });

      const response = await invokeHandler(request);
      expect(response).toBeDefined();
    });

    it('should handle dialog state IN_PROGRESS', async () => {
      const request = buildIntentRequest({
        intentName: 'CreateTaskIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
        dialogState: 'IN_PROGRESS',
        slots: {
          taskName: 'Test task',
          priority: emptySlot(),
          dueDateTime: 'tomorrow',
          category: 'WORK',
        },
      });

      const response = await invokeHandler(request);
      expect(response).toBeDefined();
    });

    it('should handle dialog state COMPLETED', async () => {
      const request = buildIntentRequest({
        intentName: 'CreateTaskIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
        dialogState: 'COMPLETED',
        slots: {
          taskName: 'Test task',
          priority: 'HIGH',
          dueDateTime: 'tomorrow',
          category: 'WORK',
        },
      });

      const response = await invokeHandler(request);
      expect(response).toBeDefined();
    });
  });

  describe('Session Edge Cases', () => {
    it('should handle new session', async () => {
      const request = buildLaunchRequest({
        accessToken: 'valid-token',
        sessionNew: true,
      });

      const response = await invokeHandler(request);
      expect(response).toBeDefined();
    });

    it('should handle existing session', async () => {
      const request = buildLaunchRequest({
        accessToken: 'valid-token',
        sessionNew: false,
        sessionAttributes: { user: mockUser },
      });

      const response = await invokeHandler(request);
      expect(response).toBeDefined();
    });

    it('should handle session without attributes', async () => {
      const request = buildLaunchRequest({
        accessToken: 'valid-token',
        sessionNew: true,
        sessionAttributes: undefined,
      });

      const response = await invokeHandler(request);
      expect(response).toBeDefined();
    });
  });

  describe('Response Structure Validation', () => {
    it('should always return valid response structure', async () => {
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
      expect(response.version).toBe('1.0');
      expect(response.response).toBeDefined();
      expect(response.response.outputSpeech).toBeDefined();
      expect(response.response.outputSpeech?.type).toBe('PlainText');
      expect((response.response.outputSpeech as any)?.text).toBeTruthy();
      expect(typeof response.response.shouldEndSession).toBe('boolean');
    });

    it('should include reprompt when appropriate', async () => {
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
      
      if (!response.response.shouldEndSession) {
        expect(response.response.reprompt).toBeDefined();
        expect(response.response.reprompt?.outputSpeech).toBeDefined();
      }
    });
  });
});

