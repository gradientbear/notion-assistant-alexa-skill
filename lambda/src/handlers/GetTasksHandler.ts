import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse } from '../utils/alexa';
import {
  findDatabaseByName,
  getAllTasks,
  getTasksByPriority,
  getTasksByStatus,
  getTasksByCategory,
  getPendingTasks,
} from '../utils/notion';

export class GetTasksHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest
      ? (handlerInput.requestEnvelope.request as any).intent?.name
      : null;
    
    const canHandle = isIntentRequest && intentName === 'GetTasksIntent';
    
    if (isIntentRequest) {
      console.log('[GetTasksHandler] canHandle check:', {
        isIntentRequest,
        intentName,
        canHandle
      });
    }
    
    return canHandle;
  }

  async handle(handlerInput: HandlerInput) {
    console.log('[GetTasksHandler] Handler invoked');
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;
    
    console.log('[GetTasksHandler] Session check:', {
      hasUser: !!user,
      hasNotionClient: !!notionClient,
      userId: user?.id
    });

    if (!user || !notionClient) {
      return buildResponse(
        handlerInput,
        'To view your tasks, you need to connect your Notion account. ' +
        'Open the Alexa app, go to Skills, find Voice Planner, and click Link Account. ' +
        'Once connected, I can show you your tasks from Notion.',
        'What would you like to do?'
      );
    }

    try {
      const request = handlerInput.requestEnvelope.request as any;
      const slots = request.intent.slots || {};
      const categorySlot = slots.category?.value;
      const statusSlot = slots.status?.value;

      console.log('[GetTasksHandler] Slots:', {
        category: categorySlot,
        status: statusSlot
      });

      const tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
      if (!tasksDbId) {
        return buildResponse(
          handlerInput,
          'I couldn\'t find your Tasks database in Notion. Please make sure it exists and try again.',
          'What would you like to do?'
        );
      }

      let tasks: any[] = [];
      let speechText = '';

      // Normalize slot values
      const normalizeCategory = (c: string | undefined): 'work' | 'personal' | 'shopping' | 'fitness' | 'health' | 'notes' | 'general' | undefined => {
        if (!c) return undefined;
        const normalized = c.toLowerCase();
        const valid = ['work', 'personal', 'shopping', 'fitness', 'health', 'notes', 'general'];
        if (valid.includes(normalized)) return normalized as any;
        return undefined;
      };

      const normalizeStatus = (s: string | undefined): 'to do' | 'in progress' | 'done' | undefined => {
        if (!s) return undefined;
        const normalized = s.toLowerCase();
        if (normalized === 'to do' || normalized === 'todo' || normalized === 'to-do') return 'to do';
        if (normalized === 'in progress' || normalized === 'in-progress' || normalized === 'doing') return 'in progress';
        if (normalized === 'done' || normalized === 'complete' || normalized === 'completed') return 'done';
        return undefined;
      };

      const category = normalizeCategory(categorySlot);
      const status = normalizeStatus(statusSlot);

      // Query tasks based on filters
      if (category && status) {
        // Filter by both category and status
        const allCategoryTasks = await getTasksByCategory(notionClient, tasksDbId, category);
        tasks = allCategoryTasks.filter(t => t.status === status);
      } else if (category) {
        // Filter by category only
        tasks = await getTasksByCategory(notionClient, tasksDbId, category);
      } else if (status) {
        // Filter by status only
        tasks = await getTasksByStatus(notionClient, tasksDbId, status);
      } else {
        // No filters - get all pending tasks (to do + in progress)
        tasks = await getPendingTasks(notionClient, tasksDbId);
      }

      // Build response
      if (tasks.length === 0) {
        if (category && status) {
          speechText = `You have no ${status} tasks in ${category}.`;
        } else if (category) {
          speechText = `You have no tasks in ${category}.`;
        } else if (status) {
          speechText = `You have no ${status} tasks.`;
        } else {
          speechText = 'You have no tasks right now.';
        }
      } else {
        const taskList = tasks.slice(0, 10).map(t => t.name).join(', ');
        const moreCount = tasks.length > 10 ? tasks.length - 10 : 0;
        
        if (category && status) {
          speechText = `You have ${tasks.length} ${status} task${tasks.length > 1 ? 's' : ''} in ${category}: ${taskList}`;
        } else if (category) {
          speechText = `You have ${tasks.length} task${tasks.length > 1 ? 's' : ''} in ${category}: ${taskList}`;
        } else if (status) {
          speechText = `You have ${tasks.length} ${status} task${tasks.length > 1 ? 's' : ''}: ${taskList}`;
        } else {
          speechText = `You have ${tasks.length} task${tasks.length > 1 ? 's' : ''}: ${taskList}`;
        }
        
        if (moreCount > 0) {
          speechText += `, and ${moreCount} more.`;
        }
      }

      return buildResponse(handlerInput, speechText, 'What else would you like to do?');
    } catch (error: any) {
      console.error('[GetTasksHandler] Error getting tasks:', error);
      console.error('[GetTasksHandler] Error details:', {
        message: error?.message,
        status: error?.status,
        code: error?.code,
        stack: error?.stack
      });
      return buildResponse(
        handlerInput,
        'I encountered an error retrieving your tasks. Please try again later.',
        'What would you like to do?'
      );
    }
  }
}

