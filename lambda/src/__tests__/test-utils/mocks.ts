/**
 * Mock implementations for external services
 * 
 * Provides mocks for Supabase, Notion API, and other external dependencies
 */

import { User } from '../../types';

/**
 * Mock user data
 */
export const mockUser: User = {
  id: 'test-user-id',
  amazon_account_id: 'test-amazon-id',
  email: 'test@example.com',
  license_key: 'TEST-LICENSE-KEY',
  notion_token: 'test-notion-token',
  notion_setup_complete: true,
  privacy_page_id: 'test-privacy-page-id',
  tasks_db_id: 'test-tasks-db-id',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

export const mockUserNoNotion: User = {
  ...mockUser,
  notion_token: null,
  notion_setup_complete: false,
  tasks_db_id: null,
};

export const mockUserNoLicense: User = {
  ...mockUser,
  license_key: '',
};

/**
 * Mock Notion task data
 */
export const mockTasks = [
  {
    id: 'task-1',
    name: 'Buy groceries',
    parsedName: 'Buy groceries',
    priority: 'HIGH' as const,
    dueDateTime: '2024-12-25T10:00:00Z',
    status: 'TO DO' as const,
    category: 'PERSONAL' as const,
    notes: 'Milk, eggs, bread',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    notionId: 'notion-task-1',
  },
  {
    id: 'task-2',
    name: 'Finish quarterly report',
    parsedName: 'Finish quarterly report',
    priority: 'NORMAL' as const,
    dueDateTime: '2024-12-30T17:00:00Z',
    status: 'TO DO' as const,
    category: 'WORK' as const,
    notes: null,
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    notionId: 'notion-task-2',
  },
  {
    id: 'task-3',
    name: 'Call dentist',
    parsedName: 'Call dentist',
    priority: 'LOW' as const,
    dueDateTime: null,
    status: 'DONE' as const,
    category: 'PERSONAL' as const,
    notes: 'Schedule cleaning',
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-03T00:00:00Z',
    notionId: 'notion-task-3',
  },
];

/**
 * Creates a mock Notion client
 */
export function createMockNotionClient() {
  return {
    databases: {
      query: jest.fn(),
      retrieve: jest.fn(),
    },
    pages: {
      create: jest.fn(),
      update: jest.fn(),
      retrieve: jest.fn(),
    },
    search: jest.fn(),
  };
}

/**
 * Sets up default mocks for database utilities
 */
export function setupDatabaseMocks() {
  const { getUserByAmazonId, getUserByAuthUserId } = require('../../utils/database');
  
  jest.mocked(getUserByAmazonId).mockResolvedValue(mockUser);
  jest.mocked(getUserByAuthUserId).mockResolvedValue(mockUser);
}

/**
 * Sets up default mocks for Notion utilities
 */
export function setupNotionMocks(mockClient: any) {
  const {
    createNotionClient,
    findDatabaseByName,
    getAllTasks,
    addTask,
    updateTask,
    updateTaskStatus,
    deleteTask,
  } = require('../../utils/notion');
  
  jest.mocked(createNotionClient).mockReturnValue(mockClient);
  jest.mocked(findDatabaseByName).mockResolvedValue('test-tasks-db-id');
  jest.mocked(getAllTasks).mockResolvedValue(mockTasks);
  jest.mocked(addTask).mockResolvedValue('new-task-id');
  jest.mocked(updateTask).mockResolvedValue(undefined);
  jest.mocked(updateTaskStatus).mockResolvedValue(undefined);
  jest.mocked(deleteTask).mockResolvedValue(undefined);
}

/**
 * Sets up environment variable mocks
 */
export function setupEnvMocks() {
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
  process.env.INTROSPECT_URL = 'https://voice-planner.com/api/auth/introspect';
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.ALLOW_LEGACY_LOOKUP = 'false';
  process.env.LEGACY_TOKEN_SUPPORT = 'false';
}

/**
 * Mocks the introspection endpoint response
 */
export function mockIntrospectionResponse(active: boolean = true, userInfo?: Partial<any>) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: active,
    status: active ? 200 : 401,
    json: jest.fn().mockResolvedValue({
      active,
      user_id: 'test-user-id',
      email: 'test@example.com',
      license_active: true,
      notion_db_id: 'test-tasks-db-id',
      amazon_account_id: 'test-amazon-id',
      ...userInfo,
    }),
  } as any);
}

/**
 * Extracts speech text from response, handling both PlainText and SSML formats
 */
export function getSpeechText(response: any): string {
  if (!response?.response?.outputSpeech) {
    return '';
  }
  
  const outputSpeech = response.response.outputSpeech;
  
  // Handle PlainText format
  if (outputSpeech.type === 'PlainText' && outputSpeech.text) {
    return outputSpeech.text;
  }
  
  // Handle SSML format
  if (outputSpeech.type === 'SSML' && outputSpeech.ssml) {
    // Extract text from SSML by removing tags
    return outputSpeech.ssml
      .replace(/<speak>/gi, '')
      .replace(/<\/speak>/gi, '')
      .replace(/<[^>]+>/g, '')
      .trim();
  }
  
  return '';
}

