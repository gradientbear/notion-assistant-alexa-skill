import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse } from '../utils/alexa';
import { findDatabaseByName, mapPageToTask } from '../utils/notion';
import { parseQueryFromUserRequest } from '../utils/parsing';
import { Client } from '@notionhq/client';
import { NotionTask } from '../types';
import { getTranslation, getLocale } from '../utils/i18n';

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
function formatTaskList(tasks: NotionTask[], handlerInput: HandlerInput): string {
  const locale = getLocale(handlerInput);
  
  if (tasks.length === 0) {
    return getTranslation(handlerInput, 'no_tasks_matching');
  }
  
  if (tasks.length === 1) {
    const task = tasks[0];
    let response = task.parsedName || task.name;
    if (task.dueDateTime) {
      const dueDate = new Date(task.dueDateTime);
      const dateStr = dueDate.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
      const hours = dueDate.getHours();
      const minutes = dueDate.getMinutes();
      if (hours !== 0 || minutes !== 0) {
        const timeStr = dueDate.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', hour12: true });
        response += getTranslation(handlerInput, 'task_due_time', { date: dateStr, time: timeStr });
      } else {
        response += getTranslation(handlerInput, 'task_due', { date: dateStr });
      }
    }
    if (task.priority === 'HIGH') {
      response += getTranslation(handlerInput, 'high_priority');
    }
    return response;
  }
  
  // Limit to 10 tasks for speech
  const displayTasks = tasks.slice(0, 10);
  const taskList = displayTasks.map((task, index) => {
    let taskStr = `${index + 1}. ${task.parsedName || task.name}`;
    if (task.dueDateTime) {
      const dueDate = new Date(task.dueDateTime);
      const dateStr = dueDate.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
      taskStr += getTranslation(handlerInput, 'task_due', { date: dateStr });
    }
    if (task.priority === 'HIGH') {
      taskStr += getTranslation(handlerInput, 'high_priority');
    }
    return taskStr;
  }).join('. ');
  
  if (tasks.length > 10) {
    return getTranslation(handlerInput, 'tasks_count_many', { count: tasks.length.toString(), list: taskList });
  }
  
  return getTranslation(handlerInput, 'tasks_count', { count: tasks.length.toString(), list: taskList });
}

export class QueryTasksHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest
      ? (handlerInput.requestEnvelope.request as any).intent?.name
      : null;
    
    return isIntentRequest && intentName === 'QueryTasksIntent';
  }

  async handle(handlerInput: HandlerInput) {
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;

    if (!user || !notionClient) {
      return buildResponse(
        handlerInput,
        getTranslation(handlerInput, 'notion_required_query'),
        getTranslation(handlerInput, 'what_would_you_like')
      );
    }

    try {
      const request = handlerInput.requestEnvelope.request as any;
      const slots = request.intent.slots || {};
      
      // Extract userRequest from AMAZON.SearchQuery slot
      const userRequest = slots.userRequest?.value;

      if (!userRequest || userRequest.trim().length === 0) {
        return buildResponse(
          handlerInput,
          getTranslation(handlerInput, 'query_task_prompt'),
          getTranslation(handlerInput, 'what_would_you_like')
        );
      }

      // Try to use stored database ID first, fallback to search
      let tasksDbId = user.tasks_db_id || null;
      
      if (!tasksDbId) {
        tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
      }
      
      if (!tasksDbId) {
        return buildResponse(
          handlerInput,
          getTranslation(handlerInput, 'notion_db_not_found_simple'),
          getTranslation(handlerInput, 'what_would_you_like')
        );
      }

      // Parse query from userRequest
      const locale = getLocale(handlerInput);
      const queryFilter = parseQueryFromUserRequest(userRequest, locale);

      // Query tasks with filter
      const tasks = await queryTasks(
        notionClient,
        tasksDbId,
        queryFilter.filters,
        queryFilter.keyword
      );

      // Format response
      const responseText = formatTaskList(tasks, handlerInput);

      return buildResponse(handlerInput, responseText, getTranslation(handlerInput, 'what_else'));
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
        getTranslation(handlerInput, 'query_task_error'),
        getTranslation(handlerInput, 'what_would_you_like')
      );
    }
  }
}

