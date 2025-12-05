import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse } from '../utils/alexa';
import { findDatabaseByName, mapPageToTask } from '../utils/notion';
import { parseQueryFromUserRequest } from '../utils/parsing';
import { Client } from '@notionhq/client';
import { NotionTask } from '../types';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = MAX_RETRIES
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && (error.status === 429 || error.status >= 500)) {
      await sleep(RETRY_DELAY);
      return withRetry(fn, retries - 1);
    }
    throw error;
  }
}

/**
 * Query tasks from Notion database with filters
 */
async function queryTasks(
  client: Client,
  databaseId: string,
  filter: any,
  keyword?: string
): Promise<NotionTask[]> {
  try {
    let queryFilter = filter;
    
    // If keyword is provided, add text search filter
    if (keyword) {
      // Notion doesn't support full-text search in database queries
      // We'll need to filter results after fetching
      // For now, we'll use the filter and then filter by keyword in memory
    }
    
    const response = await withRetry(() =>
      client.databases.query({
        database_id: databaseId,
        filter: Object.keys(queryFilter).length > 0 ? queryFilter : undefined,
        sorts: [
          { property: 'Due Date Time', direction: 'ascending' },
          { property: 'Priority', direction: 'descending' },
        ],
      })
    );

    let tasks = response.results.map(mapPageToTask);
    
    // Filter by keyword if provided
    if (keyword) {
      const keywordLower = keyword.toLowerCase();
      tasks = tasks.filter(task => 
        task.name.toLowerCase().includes(keywordLower) ||
        task.parsedName.toLowerCase().includes(keywordLower) ||
        (task.notes && task.notes.toLowerCase().includes(keywordLower))
      );
    }
    
    return tasks;
  } catch (error) {
    console.error('[QueryTasksHandler] Error querying tasks:', error);
    return [];
  }
}

/**
 * Format task list for speech response
 */
function formatTaskList(tasks: NotionTask[]): string {
  if (tasks.length === 0) {
    return 'You have no tasks matching that criteria.';
  }
  
  if (tasks.length === 1) {
    const task = tasks[0];
    let response = task.parsedName || task.name;
    if (task.dueDateTime) {
      const dueDate = new Date(task.dueDateTime);
      const dateStr = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const hours = dueDate.getHours();
      const minutes = dueDate.getMinutes();
      if (hours !== 0 || minutes !== 0) {
        const timeStr = dueDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        response += `, due ${dateStr} at ${timeStr}`;
      } else {
        response += `, due ${dateStr}`;
      }
    }
    if (task.priority === 'HIGH') {
      response += ' (high priority)';
    }
    return response;
  }
  
  // Limit to 10 tasks for speech
  const displayTasks = tasks.slice(0, 10);
  const taskList = displayTasks.map((task, index) => {
    let taskStr = `${index + 1}. ${task.parsedName || task.name}`;
    if (task.dueDateTime) {
      const dueDate = new Date(task.dueDateTime);
      const dateStr = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      taskStr += `, due ${dateStr}`;
    }
    if (task.priority === 'HIGH') {
      taskStr += ' (high priority)';
    }
    return taskStr;
  }).join('. ');
  
  if (tasks.length > 10) {
    return `You have ${tasks.length} tasks. Here are the first 10: ${taskList}.`;
  }
  
  return `You have ${tasks.length} tasks: ${taskList}.`;
}

export class QueryTasksHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest
      ? (handlerInput.requestEnvelope.request as any).intent?.name
      : null;
    
    const canHandle = isIntentRequest && intentName === 'QueryTasksIntent';
    
    if (isIntentRequest) {
      console.log('[QueryTasksHandler] canHandle check:', {
        isIntentRequest,
        intentName,
        canHandle
      });
    }
    
    return canHandle;
  }

  async handle(handlerInput: HandlerInput) {
    console.log('[QueryTasksHandler] Handler invoked');
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;
    
    console.log('[QueryTasksHandler] Session check:', {
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
      
      // Extract userRequest from AMAZON.SearchQuery slot
      const userRequest = slots.userRequest?.value;

      console.log('[QueryTasksHandler] userRequest:', userRequest);

      if (!userRequest || userRequest.trim().length === 0) {
        return buildResponse(
          handlerInput,
          'What tasks would you like to see? For example, say "tasks for today" or "high priority tasks".',
          'What would you like to do?'
        );
      }

      // Try to use stored database ID first, fallback to search
      let tasksDbId = user.tasks_db_id || null;
      
      if (!tasksDbId) {
        console.log('[QueryTasksHandler] tasks_db_id not found in user record, searching by name...');
        tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
      } else {
        console.log('[QueryTasksHandler] Using stored tasks_db_id:', tasksDbId);
      }
      
      if (!tasksDbId) {
        return buildResponse(
          handlerInput,
          'I couldn\'t find your Tasks database in Notion. Please make sure it exists and try again.',
          'What would you like to do?'
        );
      }

      // Parse query from userRequest
      const queryFilter = parseQueryFromUserRequest(userRequest);
      
      console.log('[QueryTasksHandler] Parsed query filter:', {
        type: queryFilter.type,
        filters: queryFilter.filters,
        keyword: queryFilter.keyword
      });

      // Query tasks with filter
      const tasks = await queryTasks(
        notionClient,
        tasksDbId,
        queryFilter.filters,
        queryFilter.keyword
      );

      console.log('[QueryTasksHandler] Found tasks:', tasks.length);

      // Format response
      const responseText = formatTaskList(tasks);

      return buildResponse(handlerInput, responseText, 'What else would you like to do?');
    } catch (error: any) {
      console.error('[QueryTasksHandler] Error querying tasks:', error);
      console.error('[QueryTasksHandler] Error details:', {
        message: error?.message,
        status: error?.status,
        code: error?.code,
        stack: error?.stack
      });
      return buildResponse(
        handlerInput,
        'I encountered an error retrieving your tasks. Please try again.',
        'What would you like to do?'
      );
    }
  }
}

