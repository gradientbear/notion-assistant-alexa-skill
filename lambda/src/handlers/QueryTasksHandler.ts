import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse } from '../utils/alexa';
import { findDatabaseByName, mapPageToTask } from '../utils/notion';
import { Client } from '@notionhq/client';
import { NotionTask } from '../types';
import { getTranslation, getLocale } from '../utils/i18n';
import * as chrono from 'chrono-node';

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
 * Helper function to add deleted = false filter to existing filters
 */
function addDeletedFilter(existingFilter: any): any {
  const deletedFilter = {
    property: 'Deleted',
    checkbox: { equals: false },
  };

  if (!existingFilter || Object.keys(existingFilter).length === 0) {
    return deletedFilter;
  }

  // If filter already has 'and' or 'or', combine with deleted filter
  if (existingFilter.and) {
    return {
      and: [...existingFilter.and, deletedFilter],
    };
  }

  if (existingFilter.or) {
    return {
      and: [existingFilter, deletedFilter],
    };
  }

  // Single property filter - combine with and
  return {
    and: [existingFilter, deletedFilter],
  };
}

/**
 * Query tasks from Notion database with filters (excluding deleted)
 */
async function queryTasks(
  client: Client,
  databaseId: string,
  filter: any,
  keyword?: string
): Promise<NotionTask[]> {
  try {
    let queryFilter = filter;
    
    // Add deleted filter
    queryFilter = addDeletedFilter(queryFilter);
    
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
    
    return isIntentRequest && intentName === 'ReadTasksIntent';
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
      
      // Extract values from specific slots (all optional)
      const status = slots.status?.value;
      const priority = slots.priority?.value;
      const category = slots.category?.value;
      const dueDateTime = slots.dueDateTime?.value;

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

      // Build Notion filter from slot values
      const filters: any[] = [];
      
      if (status) {
        const normalizedStatus = status.toUpperCase().replace(/\s+/g, '_');
        let statusValue = 'TO DO';
        if (normalizedStatus === 'IN_PROCESS' || normalizedStatus === 'IN_PROGRESS') {
          statusValue = 'IN_PROCESS';
        } else if (normalizedStatus === 'DONE' || normalizedStatus === 'COMPLETE') {
          statusValue = 'DONE';
        }
        filters.push({
          property: 'Status',
          select: { equals: statusValue },
        });
      }
      
      if (priority) {
        const normalizedPriority = priority.toUpperCase() === 'MEDIUM' ? 'NORMAL' : priority.toUpperCase();
        filters.push({
          property: 'Priority',
          select: { equals: normalizedPriority },
        });
      }
      
      if (category) {
        const normalizedCategory = category.toUpperCase();
        filters.push({
          property: 'Category',
          select: { equals: normalizedCategory },
        });
      }
      
      if (dueDateTime) {
        // Parse date/time from slot using chrono-node
        const chronoResult = chrono.parseDate(dueDateTime);
        
        if (chronoResult) {
          const dateStart = new Date(chronoResult);
          dateStart.setHours(0, 0, 0, 0);
          const dateEnd = new Date(chronoResult);
          dateEnd.setHours(23, 59, 59, 999);
          
          filters.push({
            property: 'Due Date Time',
            date: {
              on_or_after: dateStart.toISOString(),
              on_or_before: dateEnd.toISOString(),
            },
          });
        } else {
          // Fallback to native Date parsing
          const parsedDate = new Date(dueDateTime);
          if (!isNaN(parsedDate.getTime())) {
            const dateStart = new Date(parsedDate);
            dateStart.setHours(0, 0, 0, 0);
            const dateEnd = new Date(parsedDate);
            dateEnd.setHours(23, 59, 59, 999);
            
            filters.push({
              property: 'Due Date Time',
              date: {
                on_or_after: dateStart.toISOString(),
                on_or_before: dateEnd.toISOString(),
              },
            });
          }
        }
      }

      // Build final filter
      let finalFilter: any = {};
      if (filters.length === 1) {
        finalFilter = filters[0];
      } else if (filters.length > 1) {
        finalFilter = { and: filters };
      }

      // Query tasks with filter
      const tasks = await queryTasks(
        notionClient,
        tasksDbId,
        finalFilter,
        undefined // No keyword search
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

