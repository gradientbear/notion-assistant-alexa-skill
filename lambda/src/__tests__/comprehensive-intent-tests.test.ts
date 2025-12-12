/**
 * Comprehensive Intent Tests
 * 
 * Tests all intents, sample utterances, and slot combinations from the interaction model
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
  buildSessionEndedRequest,
  slotValue,
  emptySlot,
} from './test-utils/alexa-request-builder';
import {
  mockUser,
  mockUserNoNotion,
  createMockNotionClient,
  setupDatabaseMocks,
  setupNotionMocks,
  setupEnvMocks,
  mockIntrospectionResponse,
  getSpeechText,
} from './test-utils/mocks';

// Import mocked modules
import * as databaseUtils from '../utils/database';
import * as notionUtils from '../utils/notion';

describe('Comprehensive Intent Tests', () => {
  let mockNotionClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    setupEnvMocks();
    mockNotionClient = createMockNotionClient();
    setupDatabaseMocks();
    setupNotionMocks(mockNotionClient);
    mockIntrospectionResponse(true);
  });

  /**
   * Helper to invoke handler and get response
   */
  async function invokeHandler(request: any): Promise<ResponseEnvelope> {
    const context: any = {
      callbackWaitsForEmptyEventLoop: true,
    };
    return await handler(request, context);
  }

  /**
   * Helper to validate response structure
   */
  function validateResponse(response: ResponseEnvelope) {
    expect(response).toBeDefined();
    expect(response.version).toBe('1.0');
    expect(response.response).toBeDefined();
    expect(response.response.outputSpeech).toBeDefined();
    expect(response.response.outputSpeech?.type).toBe('PlainText');
    expect((response.response.outputSpeech as any)?.text).toBeTruthy();
  }

  describe('LaunchRequest', () => {
    it('should handle launch request with valid token', async () => {
      const request = buildLaunchRequest({
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
      });

      const response = await invokeHandler(request);
      validateResponse(response);
    });

    it('should require account linking when no token', async () => {
      const request = buildLaunchRequest({
        accessToken: undefined,
      });

      const response = await invokeHandler(request);
      validateResponse(response);
      expect(response.response.card).toBeDefined();
      expect(response.response.card?.type).toBe('LinkAccount');
    });

    it('should handle launch with Notion not connected', async () => {
      jest.mocked(databaseUtils.getUserByAuthUserId).mockResolvedValue(mockUserNoNotion);
      
      const request = buildLaunchRequest({
        accessToken: 'valid-token',
      });

      const response = await invokeHandler(request);
      validateResponse(response);
      const speechText = (response.response.outputSpeech as any)?.text || '';
      expect(speechText.toLowerCase()).toContain('notion');
    });
  });

  describe('CreateTaskIntent', () => {
    const sampleUtterances = [
      { utterance: 'add {taskName}', slots: ['taskName'] },
      { utterance: 'create a task {taskName}', slots: ['taskName'] },
      { utterance: 'remind me to {taskName}', slots: ['taskName'] },
      { utterance: 'add {taskName} tomorrow', slots: ['taskName', 'dueDateTime'] },
      { utterance: 'add {taskName} next week', slots: ['taskName', 'dueDateTime'] },
      { utterance: 'add {taskName} today', slots: ['taskName', 'dueDateTime'] },
    ];

    const priorityValues = ['LOW', 'NORMAL', 'HIGH'];
    const categoryValues = ['PERSONAL', 'WORK'];
    const dateValues = ['today', 'tomorrow', 'next week', 'in 3 days', '2024-12-25'];

    // Test all sample utterances
    sampleUtterances.forEach(({ utterance, slots }) => {
      it(`should handle "${utterance}" with all required slots`, async () => {
        for (const priority of priorityValues) {
          for (const category of categoryValues) {
            for (const date of dateValues) {
              const request = buildIntentRequest({
                intentName: 'CreateTaskIntent',
                accessToken: 'valid-token',
                sessionAttributes: { user: mockUser },
                slots: {
                  taskName: 'Test task',
                  priority,
                  dueDateTime: date,
                  category,
                },
              });

              const response = await invokeHandler(request);
              validateResponse(response);
            }
          }
        }
      });
    });

    // Test missing required slots
    it('should prompt for missing taskName', async () => {
      const request = buildIntentRequest({
        intentName: 'CreateTaskIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
        slots: {
          taskName: emptySlot(),
          priority: 'HIGH',
          dueDateTime: 'tomorrow',
          category: 'WORK',
        },
      });

      const response = await invokeHandler(request);
      validateResponse(response);
    });

    it('should prompt for missing priority', async () => {
      const request = buildIntentRequest({
        intentName: 'CreateTaskIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
        slots: {
          taskName: 'Test task',
          priority: emptySlot(),
          dueDateTime: 'tomorrow',
          category: 'WORK',
        },
      });

      const response = await invokeHandler(request);
      validateResponse(response);
    });

    it('should prompt for missing dueDateTime', async () => {
      const request = buildIntentRequest({
        intentName: 'CreateTaskIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
        slots: {
          taskName: 'Test task',
          priority: 'HIGH',
          dueDateTime: emptySlot(),
          category: 'WORK',
        },
      });

      const response = await invokeHandler(request);
      validateResponse(response);
    });

    it('should prompt for missing category', async () => {
      const request = buildIntentRequest({
        intentName: 'CreateTaskIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
        slots: {
          taskName: 'Test task',
          priority: 'HIGH',
          dueDateTime: 'tomorrow',
          category: emptySlot(),
        },
      });

      const response = await invokeHandler(request);
      validateResponse(response);
    });

    it('should handle optional notes slot', async () => {
      const request = buildIntentRequest({
        intentName: 'CreateTaskIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
        slots: {
          taskName: 'Test task',
          priority: 'HIGH',
          dueDateTime: 'tomorrow',
          category: 'WORK',
          notes: 'Additional notes here',
        },
      });

      const response = await invokeHandler(request);
      validateResponse(response);
    });

    it('should handle Notion not connected', async () => {
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
      validateResponse(response);
      const speechText = (response.response.outputSpeech as any)?.text || '';
      expect(speechText.toLowerCase()).toContain('notion');
    });
  });

  describe('ReadTasksIntent', () => {
    const sampleUtterances = [
      { utterance: 'show my tasks', slots: [] },
      { utterance: 'read my tasks', slots: [] },
      { utterance: 'show my {status} tasks', slots: ['status'] },
      { utterance: 'show tasks due {dueDateTime}', slots: ['dueDateTime'] },
      { utterance: 'show my {priority} priority tasks', slots: ['priority'] },
      { utterance: 'read my {category} tasks', slots: ['category'] },
    ];

    const statusValues = ['TO DO', 'IN PROCESS', 'DONE'];
    const priorityValues = ['LOW', 'NORMAL', 'HIGH'];
    const categoryValues = ['PERSONAL', 'WORK'];
    const dateValues = ['today', 'tomorrow', 'next week'];

    // Test all sample utterances
    sampleUtterances.forEach(({ utterance, slots }) => {
      it(`should handle "${utterance}"`, async () => {
        const requestSlots: Record<string, string> = {};
        
        if (slots.includes('status')) {
          requestSlots.status = statusValues[0];
        }
        if (slots.includes('priority')) {
          requestSlots.priority = priorityValues[0];
        }
        if (slots.includes('category')) {
          requestSlots.category = categoryValues[0];
        }
        if (slots.includes('dueDateTime')) {
          requestSlots.dueDateTime = dateValues[0];
        }

        const request = buildIntentRequest({
          intentName: 'ReadTasksIntent',
          accessToken: 'valid-token',
          sessionAttributes: { user: mockUser },
          slots: requestSlots,
        });

        const response = await invokeHandler(request);
        validateResponse(response);
      });
    });

    // Test all slot combinations
    it('should handle all slot combinations', async () => {
      const combinations: Array<Record<string, string>> = [
        {}, // No slots
        { status: 'TO DO' },
        { priority: 'HIGH' },
        { category: 'WORK' },
        { dueDateTime: 'today' },
        { status: 'TO DO', priority: 'HIGH' },
        { status: 'TO DO', category: 'WORK' },
        { priority: 'HIGH', category: 'WORK' },
        { status: 'TO DO', priority: 'HIGH', category: 'WORK' },
        { status: 'TO DO', priority: 'HIGH', category: 'WORK', dueDateTime: 'today' },
      ];

      for (const slots of combinations) {
        const request = buildIntentRequest({
          intentName: 'ReadTasksIntent',
          accessToken: 'valid-token',
          sessionAttributes: { user: mockUser },
          slots: Object.keys(slots).length > 0 ? slots : undefined,
        });

        const response = await invokeHandler(request);
        validateResponse(response);
      }
    });
  });

  describe('UpdateTaskStatusIntent', () => {
    const sampleUtterances = [
      'mark a task as {status}',
      'update a task status to {status}',
      'set status to {status}',
      'complete a task',
    ];

    const statusValues = ['TO DO', 'IN PROCESS', 'DONE'];

    sampleUtterances.forEach((utterance) => {
      statusValues.forEach((status) => {
        it(`should handle "${utterance}" with status "${status}"`, async () => {
          const request = buildIntentRequest({
            intentName: 'UpdateTaskStatusIntent',
            accessToken: 'valid-token',
            sessionAttributes: { user: mockUser },
            slots: {
              taskName: 'Buy groceries',
              status,
            },
          });

          const response = await invokeHandler(request);
          validateResponse(response);
        });
      });
    });

    it('should prompt for missing taskName', async () => {
      const request = buildIntentRequest({
        intentName: 'UpdateTaskStatusIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
        slots: {
          taskName: emptySlot(),
          status: 'DONE',
        },
      });

      const response = await invokeHandler(request);
      validateResponse(response);
    });

    it('should prompt for missing status', async () => {
      const request = buildIntentRequest({
        intentName: 'UpdateTaskStatusIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
        slots: {
          taskName: 'Buy groceries',
          status: emptySlot(),
        },
      });

      const response = await invokeHandler(request);
      validateResponse(response);
    });

    it('should handle task not found', async () => {
      jest.mocked(notionUtils.getAllTasks).mockResolvedValue([]);

      const request = buildIntentRequest({
        intentName: 'UpdateTaskStatusIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
        slots: {
          taskName: 'Non-existent task',
          status: 'DONE',
        },
      });

      const response = await invokeHandler(request);
      validateResponse(response);
      const speechText = getSpeechText(response);
      expect(speechText.toLowerCase()).toContain("couldn't find");
    });
  });

  describe('UpdateTaskPriorityIntent', () => {
    const sampleUtterances = [
      'set task priority to {priority}',
      'change priority to {priority}',
      'make priority {priority}',
      'update task priority',
    ];

    const priorityValues = ['LOW', 'NORMAL', 'HIGH'];

    sampleUtterances.forEach((utterance) => {
      priorityValues.forEach((priority) => {
        it(`should handle "${utterance}" with priority "${priority}"`, async () => {
          const request = buildIntentRequest({
            intentName: 'UpdateTaskPriorityIntent',
            accessToken: 'valid-token',
            sessionAttributes: { user: mockUser },
            slots: {
              taskName: 'Buy groceries',
              priority,
            },
          });

          const response = await invokeHandler(request);
          validateResponse(response);
        });
      });
    });

    it('should prompt for missing taskName', async () => {
      const request = buildIntentRequest({
        intentName: 'UpdateTaskPriorityIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
        slots: {
          taskName: emptySlot(),
          priority: 'HIGH',
        },
      });

      const response = await invokeHandler(request);
      validateResponse(response);
    });

    it('should prompt for missing priority', async () => {
      const request = buildIntentRequest({
        intentName: 'UpdateTaskPriorityIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
        slots: {
          taskName: 'Buy groceries',
          priority: emptySlot(),
        },
      });

      const response = await invokeHandler(request);
      validateResponse(response);
    });
  });

  describe('UpdateDueDateIntent', () => {
    const sampleUtterances = [
      'change the due date',
      'set due date',
      'update due date',
      'reschedule task',
    ];

    const dateValues = ['today', 'tomorrow', 'next week', 'in 3 days', '2024-12-25'];

    sampleUtterances.forEach((utterance) => {
      dateValues.forEach((date) => {
        it(`should handle "${utterance}" with date "${date}"`, async () => {
          const request = buildIntentRequest({
            intentName: 'UpdateDueDateIntent',
            accessToken: 'valid-token',
            sessionAttributes: { user: mockUser },
            slots: {
              taskName: 'Buy groceries',
              dueDateTime: date,
            },
          });

          const response = await invokeHandler(request);
          validateResponse(response);
        });
      });
    });

    it('should prompt for missing taskName', async () => {
      const request = buildIntentRequest({
        intentName: 'UpdateDueDateIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
        slots: {
          taskName: emptySlot(),
          dueDateTime: 'tomorrow',
        },
      });

      const response = await invokeHandler(request);
      validateResponse(response);
    });

    it('should prompt for missing dueDateTime', async () => {
      const request = buildIntentRequest({
        intentName: 'UpdateDueDateIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
        slots: {
          taskName: 'Buy groceries',
          dueDateTime: emptySlot(),
        },
      });

      const response = await invokeHandler(request);
      validateResponse(response);
    });
  });

  describe('UpdateTaskCategoryIntent', () => {
    const sampleUtterances = [
      'set task category',
      'move task to a category',
      'make a task a category',
      'change task category',
    ];

    const categoryValues = ['PERSONAL', 'WORK'];

    sampleUtterances.forEach((utterance) => {
      categoryValues.forEach((category) => {
        it(`should handle "${utterance}" with category "${category}"`, async () => {
          const request = buildIntentRequest({
            intentName: 'UpdateTaskCategoryIntent',
            accessToken: 'valid-token',
            sessionAttributes: { user: mockUser },
            slots: {
              taskName: 'Buy groceries',
              category,
            },
          });

          const response = await invokeHandler(request);
          validateResponse(response);
        });
      });
    });

    it('should prompt for missing taskName', async () => {
      const request = buildIntentRequest({
        intentName: 'UpdateTaskCategoryIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
        slots: {
          taskName: emptySlot(),
          category: 'WORK',
        },
      });

      const response = await invokeHandler(request);
      validateResponse(response);
    });

    it('should prompt for missing category', async () => {
      const request = buildIntentRequest({
        intentName: 'UpdateTaskCategoryIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
        slots: {
          taskName: 'Buy groceries',
          category: emptySlot(),
        },
      });

      const response = await invokeHandler(request);
      validateResponse(response);
    });
  });

  describe('DeleteTaskIntent', () => {
    const sampleUtterances = [
      'delete {taskName}',
      'remove {taskName}',
      'trash {taskName}',
      'get rid of {taskName}',
    ];

    sampleUtterances.forEach((utterance) => {
      it(`should handle "${utterance}"`, async () => {
        const request = buildIntentRequest({
          intentName: 'DeleteTaskIntent',
          accessToken: 'valid-token',
          sessionAttributes: { user: mockUser },
          slots: {
            taskName: 'Buy groceries',
          },
        });

        const response = await invokeHandler(request);
        validateResponse(response);
      });
    });

    it('should prompt for missing taskName', async () => {
      const request = buildIntentRequest({
        intentName: 'DeleteTaskIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
        slots: {
          taskName: emptySlot(),
        },
      });

      const response = await invokeHandler(request);
      validateResponse(response);
    });

    it('should handle task not found', async () => {
      jest.mocked(notionUtils.getAllTasks).mockResolvedValue([]);

      const request = buildIntentRequest({
        intentName: 'DeleteTaskIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
        slots: {
          taskName: 'Non-existent task',
        },
      });

      const response = await invokeHandler(request);
      validateResponse(response);
      const speechText = getSpeechText(response);
      expect(speechText.toLowerCase()).toContain("couldn't find");
    });
  });

  describe('ReorderTaskIntent', () => {
    const sampleUtterances = [
      'move a task',
      'reorder task',
      'put task at a position',
      'move task {position}',
    ];

    const positionValues = ['first', 'second', 'third', 'top', 'bottom', 'before', 'after'];

    sampleUtterances.forEach((utterance) => {
      positionValues.forEach((position) => {
        it(`should handle "${utterance}" with position "${position}"`, async () => {
          const request = buildIntentRequest({
            intentName: 'ReorderTaskIntent',
            accessToken: 'valid-token',
            sessionAttributes: { user: mockUser },
            slots: {
              taskName: 'Buy groceries',
              position,
            },
          });

          const response = await invokeHandler(request);
          validateResponse(response);
        });
      });
    });

    it('should prompt for missing taskName', async () => {
      const request = buildIntentRequest({
        intentName: 'ReorderTaskIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
        slots: {
          taskName: emptySlot(),
          position: 'first',
        },
      });

      const response = await invokeHandler(request);
      validateResponse(response);
    });

    it('should prompt for missing position', async () => {
      const request = buildIntentRequest({
        intentName: 'ReorderTaskIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
        slots: {
          taskName: 'Buy groceries',
          position: emptySlot(),
        },
      });

      const response = await invokeHandler(request);
      validateResponse(response);
    });
  });

  describe('Built-in Intents', () => {
    it('should handle AMAZON.CancelIntent', async () => {
      const request = buildIntentRequest({
        intentName: 'AMAZON.CancelIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
      });

      const response = await invokeHandler(request);
      validateResponse(response);
    });

    it('should handle AMAZON.StopIntent', async () => {
      const request = buildIntentRequest({
        intentName: 'AMAZON.StopIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
      });

      const response = await invokeHandler(request);
      validateResponse(response);
    });

    it('should handle AMAZON.HelpIntent', async () => {
      const request = buildIntentRequest({
        intentName: 'AMAZON.HelpIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
      });

      const response = await invokeHandler(request);
      validateResponse(response);
    });

    it('should handle AMAZON.FallbackIntent', async () => {
      const request = buildIntentRequest({
        intentName: 'AMAZON.FallbackIntent',
        accessToken: 'valid-token',
        sessionAttributes: { user: mockUser },
      });

      const response = await invokeHandler(request);
      validateResponse(response);
    });
  });

  describe('SessionEndedRequest', () => {
    it('should handle user-initiated session end', async () => {
      const request = buildSessionEndedRequest({
        reason: 'USER_INITIATED',
        accessToken: 'valid-token',
      });

      const response = await invokeHandler(request);
      expect(response).toBeDefined();
    });

    it('should handle error-initiated session end', async () => {
      const request = buildSessionEndedRequest({
        reason: 'ERROR',
        error: {
          type: 'INVALID_RESPONSE' as any,
          message: 'Test error',
        },
        accessToken: 'valid-token',
      });

      const response = await invokeHandler(request);
      expect(response).toBeDefined();
    });

    it('should handle exceeded max reprompts', async () => {
      const request = buildSessionEndedRequest({
        reason: 'EXCEEDED_MAX_REPROMPTS',
        accessToken: 'valid-token',
      });

      const response = await invokeHandler(request);
      expect(response).toBeDefined();
    });
  });
});

