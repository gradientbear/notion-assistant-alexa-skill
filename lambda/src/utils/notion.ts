import { Client } from '@notionhq/client';
import { NotionTask, NotionFocusLog, NotionEnergyLog } from '../types';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

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

export function createNotionClient(accessToken: string): Client {
  return new Client({ auth: accessToken });
}

export async function findDatabaseByName(
  client: Client,
  databaseName: string
): Promise<string | null> {
  try {
    const response = await withRetry(() =>
      client.search({
        query: databaseName,
        filter: {
          property: 'object',
          value: 'database',
        },
      })
    );

    const database = response.results.find(
      (item: any) => item.object === 'database' && item.title?.[0]?.plain_text === databaseName
    );

    return database ? (database as any).id : null;
  } catch (error) {
    console.error(`Error finding database ${databaseName}:`, error);
    return null;
  }
}

export async function addTask(
  client: Client,
  databaseId: string,
  taskName: string,
  priority: 'High' | 'Medium' | 'Low' = 'Medium',
  category: 'Work' | 'Personal' | 'Fitness' | 'Shopping' = 'Personal',
  dueDate?: string
): Promise<void> {
  const properties: any = {
    'Task Name': {
      title: [{ text: { content: taskName } }],
    },
    Priority: {
      select: { name: priority },
    },
    Status: {
      select: { name: 'To Do' },
    },
    Category: {
      select: { name: category },
    },
    Deleted: {
      checkbox: false,
    },
  };

  if (dueDate) {
    properties['Due Date'] = {
      date: { start: dueDate },
    };
  }

  await withRetry(() =>
    client.pages.create({
      parent: { database_id: databaseId },
      properties,
    })
  );
}

export async function getTopPriorityTasks(
  client: Client,
  databaseId: string,
  limit: number = 3
): Promise<NotionTask[]> {
  try {
    const response = await withRetry(() =>
      client.databases.query({
        database_id: databaseId,
        filter: {
          and: [
            {
              property: 'Deleted',
              checkbox: { equals: false },
            },
            {
              or: [
                { property: 'Status', select: { equals: 'To Do' } },
                { property: 'Status', select: { equals: 'In Progress' } },
              ],
            },
          ],
        },
        sorts: [
          { property: 'Priority', direction: 'descending' },
          { property: 'Due Date', direction: 'ascending' },
        ],
        page_size: limit,
      })
    );

    return response.results.map((page: any) => {
      const props = page.properties;
      return {
        id: page.id,
        name: props['Task Name']?.title?.[0]?.plain_text || 'Untitled',
        priority: props.Priority?.select?.name || 'Medium',
        dueDate: props['Due Date']?.date?.start || null,
        status: props.Status?.select?.name || 'To Do',
        category: props.Category?.select?.name || 'Personal',
        notes: props.Notes?.rich_text?.[0]?.plain_text || null,
        deleted: props.Deleted?.checkbox || false,
      };
    });
  } catch (error) {
    console.error('Error getting priority tasks:', error);
    return [];
  }
}

export async function getTodayTasks(
  client: Client,
  databaseId: string
): Promise<NotionTask[]> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const response = await withRetry(() =>
      client.databases.query({
        database_id: databaseId,
        filter: {
          and: [
            {
              property: 'Deleted',
              checkbox: { equals: false },
            },
            {
              property: 'Due Date',
              date: {
                on_or_before: tomorrow,
              },
            },
            {
              or: [
                { property: 'Status', select: { equals: 'To Do' } },
                { property: 'Status', select: { equals: 'In Progress' } },
              ],
            },
          ],
        },
        sorts: [
          { property: 'Priority', direction: 'descending' },
          { property: 'Due Date', direction: 'ascending' },
        ],
      })
    );

    return response.results.map((page: any) => {
      const props = page.properties;
      return {
        id: page.id,
        name: props['Task Name']?.title?.[0]?.plain_text || 'Untitled',
        priority: props.Priority?.select?.name || 'Medium',
        dueDate: props['Due Date']?.date?.start || null,
        status: props.Status?.select?.name || 'To Do',
        category: props.Category?.select?.name || 'Personal',
        notes: props.Notes?.rich_text?.[0]?.plain_text || null,
        deleted: props.Deleted?.checkbox || false,
      };
    });
  } catch (error) {
    console.error('Error getting today tasks:', error);
    return [];
  }
}

export async function getShoppingListTasks(
  client: Client,
  databaseId: string
): Promise<NotionTask[]> {
  try {
    const response = await withRetry(() =>
      client.databases.query({
        database_id: databaseId,
        filter: {
          and: [
            {
              property: 'Deleted',
              checkbox: { equals: false },
            },
            { property: 'Category', select: { equals: 'Shopping' } },
            {
              or: [
                { property: 'Status', select: { equals: 'To Do' } },
                { property: 'Status', select: { equals: 'In Progress' } },
              ],
            },
          ],
        },
        sorts: [{ property: 'Task Name', direction: 'ascending' }],
      })
    );

    return response.results.map((page: any) => {
      const props = page.properties;
      return {
        id: page.id,
        name: props['Task Name']?.title?.[0]?.plain_text || 'Untitled',
        priority: props.Priority?.select?.name || 'Medium',
        dueDate: props['Due Date']?.date?.start || null,
        status: props.Status?.select?.name || 'To Do',
        category: props.Category?.select?.name || 'Shopping',
        notes: props.Notes?.rich_text?.[0]?.plain_text || null,
        deleted: props.Deleted?.checkbox || false,
      };
    });
  } catch (error) {
    console.error('Error getting shopping list:', error);
    return [];
  }
}

// Helper function to map page to NotionTask
function mapPageToTask(page: any): NotionTask {
  const props = page.properties;
  return {
    id: page.id,
    name: props['Task Name']?.title?.[0]?.plain_text || 'Untitled',
    priority: props.Priority?.select?.name || 'Medium',
    dueDate: props['Due Date']?.date?.start || null,
    status: props.Status?.select?.name || 'To Do',
    category: props.Category?.select?.name || 'Personal',
    notes: props.Notes?.rich_text?.[0]?.plain_text || null,
    deleted: props.Deleted?.checkbox || false,
  };
}

// Helper function to add deleted filter to existing filter
function addDeletedFilter(existingFilter: any): any {
  if (existingFilter.and) {
    return {
      and: [
        { property: 'Deleted', checkbox: { equals: false } },
        ...existingFilter.and,
      ],
    };
  } else if (existingFilter.or) {
    return {
      and: [
        { property: 'Deleted', checkbox: { equals: false } },
        existingFilter,
      ],
    };
  } else {
    return {
      and: [
        { property: 'Deleted', checkbox: { equals: false } },
        existingFilter,
      ],
    };
  }
}

/**
 * Get all tasks (excluding deleted)
 */
export async function getAllTasks(
  client: Client,
  databaseId: string
): Promise<NotionTask[]> {
  try {
    const response = await withRetry(() =>
      client.databases.query({
        database_id: databaseId,
        filter: {
          property: 'Deleted',
          checkbox: { equals: false },
        },
        sorts: [
          { property: 'Priority', direction: 'descending' },
          { property: 'Due Date', direction: 'ascending' },
        ],
      })
    );
    return response.results.map(mapPageToTask);
  } catch (error) {
    console.error('Error getting all tasks:', error);
    return [];
  }
}

/**
 * Get tasks by priority
 */
export async function getTasksByPriority(
  client: Client,
  databaseId: string,
  priority: 'High' | 'Medium' | 'Low'
): Promise<NotionTask[]> {
  try {
    const response = await withRetry(() =>
      client.databases.query({
        database_id: databaseId,
        filter: addDeletedFilter({
          property: 'Priority',
          select: { equals: priority },
        }),
        sorts: [
          { property: 'Due Date', direction: 'ascending' },
        ],
      })
    );
    return response.results.map(mapPageToTask);
  } catch (error) {
    console.error(`Error getting ${priority} priority tasks:`, error);
    return [];
  }
}

/**
 * Get tasks by status
 */
export async function getTasksByStatus(
  client: Client,
  databaseId: string,
  status: 'To Do' | 'In Progress' | 'Done'
): Promise<NotionTask[]> {
  try {
    const response = await withRetry(() =>
      client.databases.query({
        database_id: databaseId,
        filter: addDeletedFilter({
          property: 'Status',
          select: { equals: status },
        }),
        sorts: [
          { property: 'Priority', direction: 'descending' },
          { property: 'Due Date', direction: 'ascending' },
        ],
      })
    );
    return response.results.map(mapPageToTask);
  } catch (error) {
    console.error(`Error getting ${status} tasks:`, error);
    return [];
  }
}

/**
 * Get tasks by category
 */
export async function getTasksByCategory(
  client: Client,
  databaseId: string,
  category: 'Work' | 'Personal' | 'Fitness' | 'Shopping'
): Promise<NotionTask[]> {
  try {
    const response = await withRetry(() =>
      client.databases.query({
        database_id: databaseId,
        filter: addDeletedFilter({
          property: 'Category',
          select: { equals: category },
        }),
        sorts: [
          { property: 'Priority', direction: 'descending' },
          { property: 'Due Date', direction: 'ascending' },
        ],
      })
    );
    return response.results.map(mapPageToTask);
  } catch (error) {
    console.error(`Error getting ${category} tasks:`, error);
    return [];
  }
}

/**
 * Get pending tasks (To Do or In Progress)
 */
export async function getPendingTasks(
  client: Client,
  databaseId: string
): Promise<NotionTask[]> {
  try {
    const response = await withRetry(() =>
      client.databases.query({
        database_id: databaseId,
        filter: addDeletedFilter({
          or: [
            { property: 'Status', select: { equals: 'To Do' } },
            { property: 'Status', select: { equals: 'In Progress' } },
          ],
        }),
        sorts: [
          { property: 'Priority', direction: 'descending' },
          { property: 'Due Date', direction: 'ascending' },
        ],
      })
    );
    return response.results.map(mapPageToTask);
  } catch (error) {
    console.error('Error getting pending tasks:', error);
    return [];
  }
}

/**
 * Get overdue tasks
 */
export async function getOverdueTasks(
  client: Client,
  databaseId: string
): Promise<NotionTask[]> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const response = await withRetry(() =>
      client.databases.query({
        database_id: databaseId,
        filter: addDeletedFilter({
          and: [
            {
              property: 'Due Date',
              date: { before: today },
            },
            {
              or: [
                { property: 'Status', select: { equals: 'To Do' } },
                { property: 'Status', select: { equals: 'In Progress' } },
              ],
            },
          ],
        }),
        sorts: [
          { property: 'Due Date', direction: 'ascending' },
        ],
      })
    );
    return response.results.map(mapPageToTask);
  } catch (error) {
    console.error('Error getting overdue tasks:', error);
    return [];
  }
}

/**
 * Get tasks due tomorrow
 */
export async function getTasksDueTomorrow(
  client: Client,
  databaseId: string
): Promise<NotionTask[]> {
  try {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const response = await withRetry(() =>
      client.databases.query({
        database_id: databaseId,
        filter: addDeletedFilter({
          property: 'Due Date',
          date: { equals: tomorrow },
        }),
        sorts: [
          { property: 'Priority', direction: 'descending' },
        ],
      })
    );
    return response.results.map(mapPageToTask);
  } catch (error) {
    console.error('Error getting tasks due tomorrow:', error);
    return [];
  }
}

/**
 * Get tasks due this week (next 7 days)
 */
export async function getTasksDueThisWeek(
  client: Client,
  databaseId: string
): Promise<NotionTask[]> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    const response = await withRetry(() =>
      client.databases.query({
        database_id: databaseId,
        filter: addDeletedFilter({
          and: [
            {
              property: 'Due Date',
              date: { on_or_after: today },
            },
            {
              property: 'Due Date',
              date: { on_or_before: nextWeek },
            },
          ],
        }),
        sorts: [
          { property: 'Due Date', direction: 'ascending' },
          { property: 'Priority', direction: 'descending' },
        ],
      })
    );
    return response.results.map(mapPageToTask);
  } catch (error) {
    console.error('Error getting tasks due this week:', error);
    return [];
  }
}

/**
 * Get completed tasks (optionally filtered by time range)
 */
export async function getCompletedTasks(
  client: Client,
  databaseId: string,
  timeRange?: { start: string; end: string }
): Promise<NotionTask[]> {
  try {
    let filter: any = {
      property: 'Status',
      select: { equals: 'Done' },
    };

    if (timeRange) {
      filter = {
        and: [
          { property: 'Deleted', checkbox: { equals: false } },
          { property: 'Status', select: { equals: 'Done' } },
          {
            property: 'Due Date',
            date: {
              on_or_after: timeRange.start,
              on_or_before: timeRange.end,
            },
          },
        ],
      };
    } else {
      filter = addDeletedFilter(filter);
    }

    const response = await withRetry(() =>
      client.databases.query({
        database_id: databaseId,
        filter,
        sorts: [
          { property: 'Due Date', direction: 'descending' },
        ],
      })
    );
    return response.results.map(mapPageToTask);
  } catch (error) {
    console.error('Error getting completed tasks:', error);
    return [];
  }
}

/**
 * Get tasks by date range
 */
export async function getTasksByDateRange(
  client: Client,
  databaseId: string,
  date: string
): Promise<NotionTask[]> {
  try {
    const response = await withRetry(() =>
      client.databases.query({
        database_id: databaseId,
        filter: addDeletedFilter({
          property: 'Due Date',
          date: { equals: date },
        }),
        sorts: [
          { property: 'Priority', direction: 'descending' },
        ],
      })
    );
    return response.results.map(mapPageToTask);
  } catch (error) {
    console.error('Error getting tasks by date range:', error);
    return [];
  }
}

/**
 * Get completed tasks for deletion
 */
export async function getCompletedTasksForDeletion(
  client: Client,
  databaseId: string
): Promise<NotionTask[]> {
  return getCompletedTasks(client, databaseId);
}

/**
 * Parse task properties from natural language utterance
 */
export function parseTaskFromUtterance(utterance: string): {
  taskName: string;
  priority?: 'High' | 'Medium' | 'Low';
  dueDate?: string;
  category?: 'Work' | 'Personal' | 'Fitness' | 'Shopping';
} {
  const lowerUtterance = utterance.toLowerCase().trim();
  let taskName = utterance.trim();
  let priority: 'High' | 'Medium' | 'Low' | undefined;
  let dueDate: string | undefined;
  let category: 'Work' | 'Personal' | 'Fitness' | 'Shopping' | undefined;

  // First, remove common prefixes
  taskName = taskName.replace(/^(add|remind me to|remind me)\s+/i, '').trim();

  // Parse priority (must check before removing other parts)
  if (lowerUtterance.includes('high priority') || lowerUtterance.includes('urgent')) {
    priority = 'High';
    taskName = taskName.replace(/\b(high\s+priority|urgent)\b/gi, '').trim();
  } else if (lowerUtterance.includes('low priority')) {
    priority = 'Low';
    taskName = taskName.replace(/\blow\s+priority\b/gi, '').trim();
  }

  // Parse category (be more specific to avoid false matches)
  // Check for "work task" or "to work" patterns
  if (lowerUtterance.match(/\b(work\s+task|to\s+work|work:)\b/)) {
    category = 'Work';
    taskName = taskName.replace(/\b(work\s+task|to\s+work|work:)\b/gi, '').trim();
  } else if (lowerUtterance.match(/\b(fitness|workout|to\s+fitness|fitness:)\b/)) {
    category = 'Fitness';
    taskName = taskName.replace(/\b(fitness|workout|to\s+fitness|fitness:)\b/gi, '').trim();
  } else if (lowerUtterance.match(/\b(to\s+shopping|shopping|shopping\s+list)\b/)) {
    category = 'Shopping';
    taskName = taskName.replace(/\b(to\s+shopping|shopping|shopping\s+list)\b/gi, '').trim();
  } else if (lowerUtterance.match(/\b(personal|to\s+personal|personal:)\b/)) {
    category = 'Personal';
    taskName = taskName.replace(/\b(personal|to\s+personal|personal:)\b/gi, '').trim();
  }

  // Parse dates
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (lowerUtterance.includes('today')) {
    dueDate = today.toISOString().split('T')[0];
    taskName = taskName.replace(/\btoday\b/gi, '').trim();
  } else if (lowerUtterance.includes('tomorrow')) {
    dueDate = tomorrow.toISOString().split('T')[0];
    taskName = taskName.replace(/\btomorrow\b/gi, '').trim();
  } else if (lowerUtterance.includes('due') || lowerUtterance.includes('next')) {
    // Try to extract date after "due" or "next"
    const dueMatch = lowerUtterance.match(/(?:due|next)\s+(\w+)/);
    if (dueMatch) {
      const dateStr = dueMatch[1];
      if (dateStr === 'monday' || dateStr === 'mon') {
        const monday = new Date(today);
        const day = monday.getDay();
        const diff = monday.getDate() + (day === 0 ? 1 : 8 - day);
        monday.setDate(diff);
        dueDate = monday.toISOString().split('T')[0];
      } else if (dateStr === 'tuesday' || dateStr === 'tue') {
        const tuesday = new Date(today);
        const day = tuesday.getDay();
        const diff = tuesday.getDate() + (day <= 1 ? 2 - day : 9 - day);
        tuesday.setDate(diff);
        dueDate = tuesday.toISOString().split('T')[0];
      } else if (dateStr === 'wednesday' || dateStr === 'wed') {
        const wednesday = new Date(today);
        const day = wednesday.getDay();
        const diff = wednesday.getDate() + (day <= 2 ? 3 - day : 10 - day);
        wednesday.setDate(diff);
        dueDate = wednesday.toISOString().split('T')[0];
      } else if (dateStr === 'thursday' || dateStr === 'thu') {
        const thursday = new Date(today);
        const day = thursday.getDay();
        const diff = thursday.getDate() + (day <= 3 ? 4 - day : 11 - day);
        thursday.setDate(diff);
        dueDate = thursday.toISOString().split('T')[0];
      } else if (dateStr === 'friday' || dateStr === 'fri') {
        const friday = new Date(today);
        const day = friday.getDay();
        const diff = friday.getDate() + (day <= 4 ? 5 - day : 12 - day);
        friday.setDate(diff);
        dueDate = friday.toISOString().split('T')[0];
      } else if (dateStr === 'saturday' || dateStr === 'sat') {
        const saturday = new Date(today);
        const day = saturday.getDay();
        const diff = saturday.getDate() + (day <= 5 ? 6 - day : 13 - day);
        saturday.setDate(diff);
        dueDate = saturday.toISOString().split('T')[0];
      } else if (dateStr === 'sunday' || dateStr === 'sun') {
        const sunday = new Date(today);
        const day = sunday.getDay();
        const diff = sunday.getDate() + (day === 0 ? 0 : 7 - day);
        sunday.setDate(diff);
        dueDate = sunday.toISOString().split('T')[0];
      }
      taskName = taskName.replace(/\b(due|next)\s+\w+\b/gi, '').trim();
    }
  }

  // Clean up task name - remove common suffixes and phrases
  // Remove duration/time mentions (not supported yet)
  taskName = taskName
    .replace(/\s+to\s+my\s+to-do\s+list\b/gi, '')
    .replace(/\s+to\s+my\s+to\s+do\s+list\b/gi, '') // Handle "to do" without hyphen
    .replace(/\s+to\s+my\s+tasks?\b/gi, '')
    .replace(/\s+for\s+today\b/gi, '')
    .replace(/\s+\d+\s*(minutes?|mins?|hours?|hrs?)\b/gi, '') // Remove duration
    .replace(/\s+\d+\s*(calories?|cal)\b/gi, '') // Remove calorie mentions
    .replace(/^:\s*/, '')
    .replace(/\s+/g, ' ') // Normalize multiple spaces
    .trim();

  // If task name is empty after parsing, use original utterance (fallback)
  if (!taskName || taskName.length === 0) {
    // Remove common prefixes and suffixes as fallback
    taskName = utterance
      .replace(/^(add|remind me to|remind me)\s+/i, '')
      .replace(/\s+to\s+my\s+to-do\s+list\b/gi, '')
      .replace(/\s+to\s+my\s+to\s+do\s+list\b/gi, '')
      .replace(/\s+to\s+my\s+tasks?\b/gi, '')
      .trim();
  }

  return { taskName, priority, dueDate, category };
}

export async function markTaskComplete(
  client: Client,
  pageId: string
): Promise<void> {
  await withRetry(() =>
    client.pages.update({
      page_id: pageId,
      properties: {
        Status: {
          select: { name: 'Done' },
        },
      },
    })
  );
}

/**
 * Mark multiple tasks as complete (batch operation)
 */
export async function markTasksCompleteBatch(
  client: Client,
  databaseId: string,
  taskIds: string[]
): Promise<void> {
  await Promise.all(
    taskIds.map(pageId => markTaskComplete(client, pageId))
  );
}

/**
 * Delete task (soft delete - set Deleted field to true)
 */
export async function deleteTask(
  client: Client,
  pageId: string
): Promise<void> {
  await withRetry(() =>
    client.pages.update({
      page_id: pageId,
      properties: {
        Deleted: {
          checkbox: true,
        },
      },
    })
  );
}

/**
 * Delete multiple tasks (batch operation)
 */
export async function deleteTasksBatch(
  client: Client,
  databaseId: string,
  taskIds: string[]
): Promise<void> {
  await Promise.all(
    taskIds.map(pageId => deleteTask(client, pageId))
  );
}

/**
 * Delete all completed tasks
 */
export async function deleteCompletedTasks(
  client: Client,
  databaseId: string
): Promise<number> {
  const completedTasks = await getCompletedTasksForDeletion(client, databaseId);
  if (completedTasks.length === 0) {
    return 0;
  }
  const taskIds = completedTasks.map(task => task.id);
  await deleteTasksBatch(client, databaseId, taskIds);
  return completedTasks.length;
}

export async function logFocusSession(
  client: Client,
  databaseId: string,
  duration: number,
  focusLevel: 'Low' | 'Medium' | 'High' = 'Medium'
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  await withRetry(() =>
    client.pages.create({
      parent: { database_id: databaseId },
      properties: {
        Date: {
          date: { start: today },
        },
        'Duration (minutes)': {
          number: duration,
        },
        'Focus Level': {
          select: { name: focusLevel },
        },
      },
    })
  );
}

export async function logEnergy(
  client: Client,
  databaseId: string,
  energyLevel: 'Low' | 'Medium' | 'High',
  timeOfDay: 'Morning' | 'Afternoon' | 'Evening'
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  await withRetry(() =>
    client.pages.create({
      parent: { database_id: databaseId },
      properties: {
        Date: {
          date: { start: today },
        },
        'Energy Level': {
          select: { name: energyLevel },
        },
        'Time of Day': {
          select: { name: timeOfDay },
        },
      },
    })
  );
}

export function mapEnergyLevel(level: number): 'Low' | 'Medium' | 'High' {
  if (level >= 1 && level <= 3) return 'Low';
  if (level >= 4 && level <= 7) return 'Medium';
  return 'High';
}

export function getTimeOfDay(): 'Morning' | 'Afternoon' | 'Evening' {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 18) return 'Afternoon';
  return 'Evening';
}

/**
 * Get the user's workspace root page ID
 * This is needed to create pages in the user's workspace
 */
export async function getUserWorkspace(client: Client): Promise<string | null> {
  try {
    // Search for pages in the workspace
    const response = await withRetry(() =>
      client.search({
        filter: {
          property: 'object',
          value: 'page',
        },
        page_size: 1,
      })
    );

    if (response.results.length > 0) {
      const page = response.results[0] as any;
      // Get the parent workspace/page
      if (page.parent?.workspace) {
        // For workspace root, we need to find a page and use its parent
        return page.id;
      }
      // Traverse up to find workspace root
      return page.parent?.page_id || page.id;
    }
    return null;
  } catch (error) {
    console.error('Error getting user workspace:', error);
    return null;
  }
}

/**
 * Create a Privacy page in the user's workspace
 */
export async function createPrivacyPage(client: Client): Promise<string | null> {
  try {
    // First, try to find if Privacy page already exists
    const searchResponse = await withRetry(() =>
      client.search({
        query: 'Privacy',
        filter: {
          property: 'object',
          value: 'page',
        },
      })
    );

    const existingPage = searchResponse.results.find(
      (item: any) => {
        if (item.object !== 'page') return false;
        // Check title in properties or in title array
        const title = item.properties?.title?.title?.[0]?.plain_text || 
                     item.title?.[0]?.plain_text;
        return title === 'Privacy';
      }
    );

    if (existingPage) {
      return (existingPage as any).id;
    }

    // Find a workspace page to use as parent
    // For OAuth integrations, we need to find an existing page
    const workspaceSearch = await withRetry(() =>
      client.search({
        filter: {
          property: 'object',
          value: 'page',
        },
        page_size: 1,
      })
    );

    let parentId: string | null = null;
    if (workspaceSearch.results.length > 0) {
      const firstPage = workspaceSearch.results[0] as any;
      // Try to get the workspace root or use the first page's parent
      if (firstPage.parent?.workspace) {
        // If parent is workspace, we can create as child of this page
        parentId = firstPage.id;
      } else if (firstPage.parent?.page_id) {
        parentId = firstPage.parent.page_id;
      } else {
        parentId = firstPage.id;
      }
    }

    if (!parentId) {
      throw new Error('Could not find a parent page in workspace');
    }

    // Create new Privacy page as child of workspace page
    const pageResponse = await withRetry(() =>
      client.pages.create({
        parent: {
          type: 'page_id',
          page_id: parentId,
        },
        properties: {
          title: [
            {
              text: {
                content: 'Privacy',
              },
            },
          ],
        },
      })
    );

    return pageResponse.id;
  } catch (error) {
    console.error('Error creating Privacy page:', error);
    return null;
  }
}

/**
 * Create Tasks database on a parent page
 */
export async function createTasksDatabase(
  client: Client,
  parentPageId: string
): Promise<string | null> {
  try {
    // Check if database already exists
    const searchResponse = await withRetry(() =>
      client.search({
        query: 'Tasks',
        filter: {
          property: 'object',
          value: 'database',
        },
      })
    );

    const existingDb = searchResponse.results.find(
      (item: any) => item.object === 'database' && item.title?.[0]?.plain_text === 'Tasks'
    );

    if (existingDb) {
      return (existingDb as any).id;
    }

    // Create Tasks database
    const dbResponse = await withRetry(() =>
      client.databases.create({
        parent: {
          type: 'page_id',
          page_id: parentPageId,
        },
        title: [
          {
            text: {
              content: 'Tasks',
            },
          },
        ],
        properties: {
          'Task Name': {
            title: {},
          },
          Priority: {
            select: {
              options: [
                { name: 'High', color: 'red' },
                { name: 'Medium', color: 'yellow' },
                { name: 'Low', color: 'blue' },
              ],
            },
          },
          Status: {
            select: {
              options: [
                { name: 'To Do', color: 'gray' },
                { name: 'In Progress', color: 'blue' },
                { name: 'Done', color: 'green' },
              ],
            },
          },
          Category: {
            select: {
              options: [
                { name: 'Work', color: 'orange' },
                { name: 'Personal', color: 'purple' },
                { name: 'Fitness', color: 'pink' },
                { name: 'Shopping', color: 'green' },
              ],
            },
          },
          'Due Date': {
            date: {},
          },
          Notes: {
            rich_text: {},
          },
          Deleted: {
            checkbox: {},
          },
        },
      })
    );

    return dbResponse.id;
  } catch (error) {
    console.error('Error creating Tasks database:', error);
    return null;
  }
}

/**
 * Create Focus_Logs database on a parent page
 */
export async function createFocusLogsDatabase(
  client: Client,
  parentPageId: string
): Promise<string | null> {
  try {
    // Check if database already exists
    const searchResponse = await withRetry(() =>
      client.search({
        query: 'Focus_Logs',
        filter: {
          property: 'object',
          value: 'database',
        },
      })
    );

    const existingDb = searchResponse.results.find(
      (item: any) => item.object === 'database' && item.title?.[0]?.plain_text === 'Focus_Logs'
    );

    if (existingDb) {
      return (existingDb as any).id;
    }

    // Create Focus_Logs database
    const dbResponse = await withRetry(() =>
      client.databases.create({
        parent: {
          type: 'page_id',
          page_id: parentPageId,
        },
        title: [
          {
            text: {
              content: 'Focus_Logs',
            },
          },
        ],
        properties: {
          Date: {
            date: {},
          },
          'Duration (minutes)': {
            number: {},
          },
          'Focus Level': {
            select: {
              options: [
                { name: 'Low', color: 'red' },
                { name: 'Medium', color: 'yellow' },
                { name: 'High', color: 'green' },
              ],
            },
          },
          Notes: {
            rich_text: {},
          },
        },
      })
    );

    return dbResponse.id;
  } catch (error) {
    console.error('Error creating Focus_Logs database:', error);
    return null;
  }
}

/**
 * Create Energy_Logs database on a parent page
 */
export async function createEnergyLogsDatabase(
  client: Client,
  parentPageId: string
): Promise<string | null> {
  try {
    // Check if database already exists
    const searchResponse = await withRetry(() =>
      client.search({
        query: 'Energy_Logs',
        filter: {
          property: 'object',
          value: 'database',
        },
      })
    );

    const existingDb = searchResponse.results.find(
      (item: any) => item.object === 'database' && item.title?.[0]?.plain_text === 'Energy_Logs'
    );

    if (existingDb) {
      return (existingDb as any).id;
    }

    // Create Energy_Logs database
    const dbResponse = await withRetry(() =>
      client.databases.create({
        parent: {
          type: 'page_id',
          page_id: parentPageId,
        },
        title: [
          {
            text: {
              content: 'Energy_Logs',
            },
          },
        ],
        properties: {
          Date: {
            date: {},
          },
          'Energy Level': {
            select: {
              options: [
                { name: 'Low', color: 'red' },
                { name: 'Medium', color: 'yellow' },
                { name: 'High', color: 'green' },
              ],
            },
          },
          'Time of Day': {
            select: {
              options: [
                { name: 'Morning', color: 'orange' },
                { name: 'Afternoon', color: 'yellow' },
                { name: 'Evening', color: 'purple' },
              ],
            },
          },
          Notes: {
            rich_text: {},
          },
        },
      })
    );

    return dbResponse.id;
  } catch (error) {
    console.error('Error creating Energy_Logs database:', error);
    return null;
  }
}

/**
 * Complete Notion setup for a user:
 * 1. Create Privacy page
 * 2. Create three databases (Tasks, Focus_Logs, Energy_Logs)
 * Returns an object with all created IDs
 */
export async function setupNotionWorkspace(
  client: Client
): Promise<{
  privacyPageId: string | null;
  tasksDbId: string | null;
  focusLogsDbId: string | null;
  energyLogsDbId: string | null;
}> {
  try {
    // Step 1: Create Privacy page
    const privacyPageId = await createPrivacyPage(client);
    if (!privacyPageId) {
      throw new Error('Failed to create Privacy page');
    }

    // Step 2: Create databases on the Privacy page
    const tasksDbId = await createTasksDatabase(client, privacyPageId);
    const focusLogsDbId = await createFocusLogsDatabase(client, privacyPageId);
    const energyLogsDbId = await createEnergyLogsDatabase(client, privacyPageId);

    return {
      privacyPageId,
      tasksDbId: tasksDbId || null,
      focusLogsDbId: focusLogsDbId || null,
      energyLogsDbId: energyLogsDbId || null,
    };
  } catch (error) {
    console.error('Error setting up Notion workspace:', error);
    return {
      privacyPageId: null,
      tasksDbId: null,
      focusLogsDbId: null,
      energyLogsDbId: null,
    };
  }
}

