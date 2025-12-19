import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse } from '../utils/alexa';
import { findDatabaseByName, mapPageToTask } from '../utils/notion';
import { Client } from '@notionhq/client';
import { NotionTask } from '../types';
import { getTranslation, getLocale } from '../utils/i18n';
import { normalizeStatus, normalizePriority, normalizeCategory } from '../utils/normalization';
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
    const toLocalYyyyMmDd = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

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
      let dueDateTime = slots.dueDateTime?.value;
      
      // Handle special cases where utterances don't have explicit slots
      // Collect all slot values to check for keywords
      const allSlotValues = [
        status,
        priority,
        category,
        dueDateTime
      ].filter(Boolean).join(' ').toLowerCase();
      
      // Also check slot resolutions for additional context
      const slotResolutions = Object.values(slots).map((s: any) => {
        if (s?.resolutions?.resolutionsPerAuthority?.[0]?.values?.[0]?.value?.name) {
          return s.resolutions.resolutionsPerAuthority[0].values[0].value.name;
        }
        return s?.value || '';
      }).filter(Boolean).join(' ').toLowerCase();
      
      const allText = (allSlotValues + ' ' + slotResolutions).toLowerCase();
      
      // Handle "cosa ho per oggi" - if no dueDateTime slot but "oggi" appears anywhere
      // Also handle "per oggi" pattern explicitly
      if (!dueDateTime && (allText.includes('oggi') || allText.includes('today') || 
          allText.includes('per oggi') || allText.includes('for today'))) {
        dueDateTime = 'oggi';
      }
      
      // Handle "mostra attività scadute" - detect overdue queries
      // Check in slot values, resolutions, and also check if status slot might contain "scadute"
      const isOverdueQuery = allText.includes('scadute') || 
                            allText.includes('scaduto') || 
                            allText.includes('overdue') ||
                            allText.includes('in ritardo') ||
                            (status && (status.toLowerCase().includes('scadute') || status.toLowerCase().includes('scaduto')));

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
        const statusValue = normalizeStatus(status);
        filters.push({
          property: 'Status',
          select: { equals: statusValue },
        });
      }
      
      if (priority) {
        const normalizedPriority = normalizePriority(priority);
        filters.push({
          property: 'Priority',
          select: { equals: normalizedPriority },
        });
      }
      
      if (category) {
        const normalizedCategory = normalizeCategory(category);
        filters.push({
          property: 'Category',
          select: { equals: normalizedCategory },
        });
      }
      
      if (dueDateTime) {
        // Clean the dueDateTime value - remove "scadenza" prefix if present (Italian)
        let cleanedDueDateTime = dueDateTime.trim();
        cleanedDueDateTime = cleanedDueDateTime.replace(/^scadenza\s+/i, '');
        // Also remove common Italian prepositions/articles so "del 18 dicembre" parses correctly
        cleanedDueDateTime = cleanedDueDateTime.replace(
          /^(del(?:lo|la|le|li)?|dell[oaie]?|dei|degli|delle|di|il|lo|la|i|gli|le)\s+/i,
          ''
        );
        
        const lowerDueDateTime = cleanedDueDateTime.toLowerCase();
        const now = new Date();
        let dateFilter: any = null;
        
        // Handle Italian keywords explicitly (oggi, domani)
        if (lowerDueDateTime.includes('oggi') || lowerDueDateTime === 'today') {
          const todayStart = new Date(now);
          todayStart.setHours(0, 0, 0, 0);
          
          dateFilter = {
            property: 'Due Date Time',
            date: {
              // Use date-only equality to avoid timezone/range issues
              equals: toLocalYyyyMmDd(todayStart),
            },
          };
        } else if (lowerDueDateTime.includes('domani') || lowerDueDateTime === 'tomorrow') {
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          const tomorrowStart = new Date(tomorrow);
          tomorrowStart.setHours(0, 0, 0, 0);
          
          dateFilter = {
            property: 'Due Date Time',
            date: {
              // Use date-only equality to avoid timezone/range issues
              equals: toLocalYyyyMmDd(tomorrowStart),
            },
          };
        } else {
          // Map Italian month names to numbers
          const italianMonths: { [key: string]: number } = {
            'gennaio': 0, 'febbraio': 1, 'marzo': 2, 'aprile': 3,
            'maggio': 4, 'giugno': 5, 'luglio': 6, 'agosto': 7,
            'settembre': 8, 'ottobre': 9, 'novembre': 10, 'dicembre': 11
          };
          
          // Check for Italian date pattern: "DD mese" or "mese DD" (e.g., "25 dicembre", "dicembre 25")
          const italianDatePattern1 = /(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)/i;
          const italianDatePattern2 = /(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{1,2})/i;
          const italianDateMatch1 = cleanedDueDateTime.match(italianDatePattern1);
          const italianDateMatch2 = cleanedDueDateTime.match(italianDatePattern2);
          const italianDateMatch = italianDateMatch1 || italianDateMatch2;
          
          if (italianDateMatch) {
            let day: number;
            let monthName: string;
            if (italianDateMatch1) {
              day = parseInt(italianDateMatch1[1], 10);
              monthName = italianDateMatch1[2].toLowerCase();
            } else if (italianDateMatch2) {
              day = parseInt(italianDateMatch2[2], 10);
              monthName = italianDateMatch2[1].toLowerCase();
            } else {
              // This should never happen, but TypeScript requires it
              day = 1;
              monthName = 'gennaio';
            }
            const month = italianMonths[monthName];
            const year = now.getFullYear();
            const todayStart = new Date(now);
            todayStart.setHours(0, 0, 0, 0);
            
            // Create date - if month/day has passed this year (at day granularity), use next year
            // IMPORTANT: compare against "today at 00:00", not "now", or "18 dicembre" on Dec 18 would incorrectly become next year.
            const dateStart = new Date(year, month, day, 0, 0, 0, 0);
            if (dateStart < todayStart) {
              dateStart.setFullYear(year + 1);
            }
            
            dateFilter = {
              property: 'Due Date Time',
              date: {
                // Use date-only equality to avoid timezone/range issues
                equals: toLocalYyyyMmDd(dateStart),
              },
            };
          } else {
            // Parse date/time from slot using chrono-node
            const chronoResult = chrono.parseDate(cleanedDueDateTime);
            
            if (chronoResult) {
              const dateStart = new Date(chronoResult);
              dateStart.setHours(0, 0, 0, 0);
              
              dateFilter = {
                property: 'Due Date Time',
                date: {
                  // Use date-only equality to avoid timezone/range issues
                  equals: toLocalYyyyMmDd(dateStart),
                },
              };
            } else {
              // Fallback to native Date parsing
              const parsedDate = new Date(cleanedDueDateTime);
              if (!isNaN(parsedDate.getTime())) {
                const dateStart = new Date(parsedDate);
                dateStart.setHours(0, 0, 0, 0);
                
                dateFilter = {
                  property: 'Due Date Time',
                  date: {
                    // Use date-only equality to avoid timezone/range issues
                    equals: toLocalYyyyMmDd(dateStart),
                  },
                };
              }
            }
          }
        }
        
        if (dateFilter) {
          filters.push(dateFilter);
        }
      }
      
      // Handle overdue queries ("mostra attività scadute")
      if (isOverdueQuery && !dueDateTime) {
        const now = new Date();
        filters.push({
          and: [
            {
              property: 'Due Date Time',
              date: {
                before: now.toISOString(),
              },
            },
            {
              property: 'Status',
              select: {
                does_not_equal: 'DONE',
              },
            },
          ],
        });
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

