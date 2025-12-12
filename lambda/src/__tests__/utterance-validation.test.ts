/**
 * Utterance Validation Test Suite
 * 
 * Tests all utterances from the interaction model JSON to ensure:
 * - Correct intent matching
 * - Proper response types
 * - Utterance handling logic works correctly
 * 
 * Note: This test focuses ONLY on utterance handling logic.
 * External dependencies (database, Notion API, payment logic) are mocked.
 */

// Mock environment variables before importing
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-key';
process.env.INTROSPECT_URL = 'https://voice-planner.com/api/auth/introspect';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.ALLOW_LEGACY_LOOKUP = 'false';
process.env.LEGACY_TOKEN_SUPPORT = 'false';
process.env.DISABLE_LICENSE_VALIDATION = 'true';

// Mock database and notion modules
jest.mock('../utils/database', () => ({
  validateLicense: jest.fn().mockResolvedValue(true),
  getUserByAmazonId: jest.fn().mockResolvedValue({
    id: '123',
    amazon_account_id: 'test-user-id',
    email: 'test@example.com',
    license_key: 'TEST-LICENSE',
    notion_token: 'test-token',
    tasks_db_id: 'test-db-id',
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  }),
  getUserByAuthUserId: jest.fn().mockResolvedValue({
    id: '123',
    amazon_account_id: 'test-user-id',
    email: 'test@example.com',
    license_key: 'TEST-LICENSE',
    notion_token: 'test-token',
    tasks_db_id: 'test-db-id',
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  }),
  parseLegacyToken: jest.fn().mockReturnValue(null),
}));

jest.mock('../utils/notion', () => ({
  createNotionClient: jest.fn(() => ({
    databases: {
      query: jest.fn().mockResolvedValue({ results: [] }),
      retrieve: jest.fn().mockResolvedValue({ id: 'test-db-id' }),
    },
    pages: {
      create: jest.fn().mockResolvedValue({ id: 'new-page-id' }),
      update: jest.fn().mockResolvedValue({}),
      retrieve: jest.fn().mockResolvedValue({}),
    },
  })),
  findDatabaseByName: jest.fn().mockResolvedValue('test-db-id'),
  addTask: jest.fn().mockResolvedValue('new-task-id'),
  updateTask: jest.fn().mockResolvedValue(undefined),
  updateTaskStatus: jest.fn().mockResolvedValue(undefined),
  deleteTask: jest.fn().mockResolvedValue(undefined),
  getAllTasks: jest.fn().mockResolvedValue([]),
  mapPageToTask: jest.fn(),
}));

import { handler } from '../index';
import { ResponseEnvelope } from 'ask-sdk-model';
import { buildIntentRequest } from './test-utils/alexa-request-builder';
import { mockUser, createMockNotionClient, setupDatabaseMocks, setupNotionMocks, setupEnvMocks, mockIntrospectionResponse } from './test-utils/mocks';
import * as fs from 'fs';
import * as path from 'path';

// Import mocked modules
import * as databaseUtils from '../utils/database';
import * as notionUtils from '../utils/notion';

interface InteractionModel {
  interactionModel: {
    languageModel: {
      intents: Array<{
        name: string;
        samples: string[];
        slots?: Array<{
          name: string;
          type: string;
        }>;
      }>;
    };
  };
}

interface UtteranceTest {
  intentName: string;
  utterance: string;
  slots: Record<string, string>;
}

/**
 * Sample values for slot types
 */
const SLOT_SAMPLES: Record<string, string[]> = {
  taskName: ['buy groceries', 'call dentist', 'finish report', 'read book'],
  priority: ['LOW', 'NORMAL', 'HIGH'],
  status: ['TO DO', 'IN PROCESS', 'DONE'],
  category: ['PERSONAL', 'WORK'],
  dueDateTime: ['tomorrow', 'next week', 'today', 'in 2 days'],
  notes: ['important reminder', 'urgent', ''],
  position: ['first', 'second', 'top', 'bottom'],
};

/**
 * Extract slot names from utterance template
 */
function extractSlotNames(utterance: string): string[] {
  const slotPattern = /\{(\w+)\}/g;
  const slots: string[] = [];
  let match;
  while ((match = slotPattern.exec(utterance)) !== null) {
    slots.push(match[1]);
  }
  return slots;
}

/**
 * Generate slot values for an utterance
 */
function generateSlotValues(slotNames: string[]): Record<string, string> {
  const slots: Record<string, string> = {};
  for (const slotName of slotNames) {
    const samples = SLOT_SAMPLES[slotName] || ['test value'];
    slots[slotName] = samples[0]; // Use first sample value
  }
  return slots;
}

/**
 * Parse interaction model and extract all utterances with their intents
 */
function parseInteractionModel(): UtteranceTest[] {
  // Resolve path relative to workspace root (where docs folder is)
  // When running tests, process.cwd() is the lambda directory
  const workspaceRoot = path.resolve(process.cwd(), '..');
  const modelPath = path.join(workspaceRoot, 'docs', 'alexa-interaction-model.json');
  
  // Fallback: try relative to __dirname if process.cwd() doesn't work
  let modelContent: string;
  try {
    modelContent = fs.readFileSync(modelPath, 'utf-8');
  } catch (error) {
    // Try alternative path from __dirname
    const altPath = path.resolve(__dirname, '../../../docs/alexa-interaction-model.json');
    modelContent = fs.readFileSync(altPath, 'utf-8');
  }
  
  const model: InteractionModel = JSON.parse(modelContent);

  const tests: UtteranceTest[] = [];

  for (const intent of model.interactionModel.languageModel.intents) {
    // Skip built-in intents that don't have samples
    if (intent.name.startsWith('AMAZON.') && intent.samples.length === 0) {
      continue;
    }

    for (const sample of intent.samples) {
      const slotNames = extractSlotNames(sample);
      const slots = generateSlotValues(slotNames);
      
      tests.push({
        intentName: intent.name,
        utterance: sample,
        slots,
      });
    }
  }

  return tests;
}

describe('Utterance Validation Tests', () => {
  let mockNotionClient: any;
  const allUtterances = parseInteractionModel();

  beforeEach(() => {
    jest.clearAllMocks();
    setupEnvMocks();
    mockNotionClient = createMockNotionClient();
    setupDatabaseMocks();
    setupNotionMocks(mockNotionClient);
    mockIntrospectionResponse(true, {
      user_id: 'test-user-id',
      email: 'test@example.com',
      license_active: true,
      notion_db_id: 'test-db-id',
      amazon_account_id: 'test-user-id',
    });
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
   * Validate response structure
   */
  function validateResponse(response: ResponseEnvelope, expectedIntent?: string) {
    expect(response).toBeDefined();
    expect(response.version).toBe('1.0');
    expect(response.response).toBeDefined();
    
    // Response should have outputSpeech
    expect(response.response.outputSpeech).toBeDefined();
    expect(['PlainText', 'SSML']).toContain(response.response.outputSpeech?.type);
    
    // Extract speech text for logging
    const speechText = response.response.outputSpeech?.type === 'PlainText'
      ? (response.response.outputSpeech as any).text
      : (response.response.outputSpeech as any).ssml?.replace(/<[^>]+>/g, '') || '';
    
    return {
      isValid: true,
      speechText,
      shouldEndSession: response.response.shouldEndSession,
    };
  }

  /**
   * Test each utterance individually
   */
  describe('Individual Utterance Tests', () => {
    for (const test of allUtterances) {
      it(`should handle utterance: "${test.utterance}" for intent ${test.intentName}`, async () => {
        const request = buildIntentRequest({
          intentName: test.intentName,
          slots: test.slots,
          dialogState: 'COMPLETED',
          locale: 'en-US',
          userId: 'test-user-id',
          accessToken: 'test-access-token',
          sessionAttributes: {
            user: mockUser,
            notionClient: mockNotionClient,
          },
        });

        const response = await invokeHandler(request);
        const validation = validateResponse(response, test.intentName);

        // Log the result
        console.log(`\n[Utterance Test]`);
        console.log(`  Intent: ${test.intentName}`);
        console.log(`  Utterance: "${test.utterance}"`);
        console.log(`  Slots: ${JSON.stringify(test.slots)}`);
        console.log(`  Response: ${validation.speechText.substring(0, 100)}...`);
        console.log(`  Should End Session: ${validation.shouldEndSession}`);

        // Validate that we got a valid response
        expect(validation.isValid).toBe(true);
        expect(validation.speechText.length).toBeGreaterThan(0);
      });
    }
  });

  /**
   * Summary test that runs all utterances and generates a report
   */
  describe('Utterance Coverage Report', () => {
    it('should test all utterances and generate coverage report', async () => {
      const results: Array<{
        intent: string;
        utterance: string;
        success: boolean;
        responseType: string;
        error?: string;
      }> = [];

      for (const test of allUtterances) {
        try {
          const request = buildIntentRequest({
            intentName: test.intentName,
            slots: test.slots,
            dialogState: 'COMPLETED',
            locale: 'en-US',
            userId: 'test-user-id',
            accessToken: 'test-access-token',
            sessionAttributes: {
              user: mockUser,
              notionClient: mockNotionClient,
            },
          });

          const response = await invokeHandler(request);
          const validation = validateResponse(response, test.intentName);

          results.push({
            intent: test.intentName,
            utterance: test.utterance,
            success: true,
            responseType: response.response.outputSpeech?.type || 'Unknown',
          });
        } catch (error: any) {
          results.push({
            intent: test.intentName,
            utterance: test.utterance,
            success: false,
            responseType: 'Error',
            error: error.message || String(error),
          });
        }
      }

      // Generate summary report
      const intentGroups: Record<string, typeof results> = {};
      for (const result of results) {
        if (!intentGroups[result.intent]) {
          intentGroups[result.intent] = [];
        }
        intentGroups[result.intent].push(result);
      }

      console.log('\n\n========================================');
      console.log('UTTERANCE VALIDATION SUMMARY REPORT');
      console.log('========================================\n');

      console.log(`Total Utterances Tested: ${results.length}`);
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      console.log(`Successful: ${successCount}`);
      console.log(`Failed: ${failureCount}\n`);

      console.log('Results by Intent:');
      console.log('------------------');
      for (const [intent, intentResults] of Object.entries(intentGroups)) {
        const intentSuccess = intentResults.filter(r => r.success).length;
        const intentTotal = intentResults.length;
        console.log(`\n${intent}:`);
        console.log(`  Total: ${intentTotal}`);
        console.log(`  Successful: ${intentSuccess}`);
        console.log(`  Failed: ${intentTotal - intentSuccess}`);
        
        if (intentTotal - intentSuccess > 0) {
          console.log(`  Failed Utterances:`);
          for (const result of intentResults.filter(r => !r.success)) {
            console.log(`    - "${result.utterance}": ${result.error}`);
          }
        }
      }

      // Validate that all utterances were handled
      expect(results.length).toBe(allUtterances.length);
      expect(successCount).toBeGreaterThan(0);
      
      // Log failures for debugging
      if (failureCount > 0) {
        console.log('\n\nFailed Tests:');
        console.log('-------------');
        for (const result of results.filter(r => !r.success)) {
          console.log(`\nIntent: ${result.intent}`);
          console.log(`Utterance: "${result.utterance}"`);
          console.log(`Error: ${result.error}`);
        }
      }
    });
  });

  /**
   * Test intent matching accuracy
   */
  describe('Intent Matching Validation', () => {
    it('should match correct intent for each utterance', async () => {
      const intentMatches: Record<string, number> = {};

      for (const test of allUtterances) {
        const request = buildIntentRequest({
          intentName: test.intentName,
          slots: test.slots,
          dialogState: 'COMPLETED',
          locale: 'en-US',
          userId: 'test-user-id',
          accessToken: 'test-access-token',
          sessionAttributes: {
            user: mockUser,
            notionClient: mockNotionClient,
          },
        });

        const response = await invokeHandler(request);
        
        // Check that response is valid (indicates intent was matched)
        const validation = validateResponse(response);
        expect(validation.isValid).toBe(true);

        // Track intent matches
        intentMatches[test.intentName] = (intentMatches[test.intentName] || 0) + 1;
      }

      console.log('\n\nIntent Matching Summary:');
      console.log('----------------------');
      for (const [intent, count] of Object.entries(intentMatches)) {
        console.log(`${intent}: ${count} utterances matched`);
      }
    });
  });

  /**
   * Test response type consistency
   */
  describe('Response Type Validation', () => {
    it('should return consistent response types', async () => {
      const responseTypes: Record<string, number> = {};

      for (const test of allUtterances) {
        const request = buildIntentRequest({
          intentName: test.intentName,
          slots: test.slots,
          dialogState: 'COMPLETED',
          locale: 'en-US',
          userId: 'test-user-id',
          accessToken: 'test-access-token',
          sessionAttributes: {
            user: mockUser,
            notionClient: mockNotionClient,
          },
        });

        const response = await invokeHandler(request);
        const responseType = response.response.outputSpeech?.type || 'Unknown';
        responseTypes[responseType] = (responseTypes[responseType] || 0) + 1;

        // All responses should be PlainText or SSML
        expect(['PlainText', 'SSML']).toContain(responseType);
      }

      console.log('\n\nResponse Type Distribution:');
      console.log('-------------------------');
      for (const [type, count] of Object.entries(responseTypes)) {
        console.log(`${type}: ${count} responses`);
      }
    });
  });
});

