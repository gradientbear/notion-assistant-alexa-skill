import { PriorityListHandler } from '../../handlers/PriorityListHandler';
import { HandlerInput } from 'ask-sdk-core';
import { RequestEnvelope } from 'ask-sdk-model';
import { findDatabaseByName, getTopPriorityTasks } from '../../utils/notion';

jest.mock('../../utils/notion');

describe('PriorityListHandler', () => {
  let handler: PriorityListHandler;
  let mockHandlerInput: Partial<HandlerInput>;

  beforeEach(() => {
    handler = new PriorityListHandler();
    jest.clearAllMocks();

    mockHandlerInput = {
      requestEnvelope: {
        request: {
          type: 'IntentRequest',
          intent: {
            name: 'PriorityListIntent',
          },
        },
        session: {
          user: { userId: 'test-user' },
        },
      } as RequestEnvelope,
      attributesManager: {
        getSessionAttributes: jest.fn().mockReturnValue({
          user: {
            id: '123',
            notion_token: 'test-token',
          },
          notionClient: {},
        }),
        setSessionAttributes: jest.fn(),
      } as any,
      responseBuilder: {
        speak: jest.fn().mockReturnThis(),
        withShouldEndSession: jest.fn().mockReturnThis(),
        getResponse: jest.fn().mockReturnValue({}),
      } as any,
    };
  });

  it('should handle PriorityListIntent', () => {
    expect(handler.canHandle(mockHandlerInput as HandlerInput)).toBe(true);
  });

  it('should return error when Notion not connected', async () => {
    mockHandlerInput.attributesManager!.getSessionAttributes = jest.fn().mockReturnValue({
      user: null,
    });

    const response = await handler.handle(mockHandlerInput as HandlerInput);
    expect(response).toBeDefined();
  });

  it('should return tasks when database found', async () => {
    (findDatabaseByName as jest.Mock).mockResolvedValue('db-id-123');
    (getTopPriorityTasks as jest.Mock).mockResolvedValue([
      {
        id: '1',
        name: 'Task 1',
        priority: 'High',
        dueDate: null,
        status: 'To Do',
        category: 'Work',
        notes: null,
      },
    ]);

    const response = await handler.handle(mockHandlerInput as HandlerInput);
    expect(response).toBeDefined();
    expect(findDatabaseByName).toHaveBeenCalled();
    expect(getTopPriorityTasks).toHaveBeenCalled();
  });
});

