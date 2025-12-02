import { Client } from '@notionhq/client';
import { NotionTask, NotionFocusLog, NotionEnergyLog, NotionShoppingItem, NotionWorkout, NotionMeal, NotionNote } from '../types';

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
  priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal',
  category: 'work' | 'personal' | 'shopping' | 'fitness' | 'health' | 'notes' | 'general' = 'personal',
  dueDate?: string,
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly',
  tags?: string[]
): Promise<string> {
  // Ensure recurrence defaults to 'none' if not provided
  const recurrenceValue: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' = recurrence || 'none';
  
  const properties: any = {
    Name: {
      title: [{ text: { content: taskName } }],
    },
    Priority: {
      select: { name: priority },
    },
    Status: {
      select: { name: 'to do' },
    },
    Category: {
      select: { name: category },
    },
    Recurring: {
      select: { name: recurrenceValue },
    },
  };

  if (dueDate) {
    properties['Due Date'] = {
      date: { start: dueDate },
    };
  }

  if (tags && tags.length > 0) {
    properties.Tags = {
      multi_select: tags.map(tag => ({ name: tag })),
    };
  }

  // Store NotionID (will be set after creation)
  properties.NotionID = {
    rich_text: [{ text: { content: '' } }], // Will be updated after creation
  };

  try {
    const response = await withRetry(() =>
      client.pages.create({
        parent: { database_id: databaseId },
        properties,
      })
    );
    
    // Verify the page was created
    if (!response || !response.id) {
      console.error('[addTask] Failed to create task - no page ID in response:', response);
      throw new Error('Failed to create task in Notion: No page ID returned');
    }
    
    console.log('[addTask] Task created successfully:', {
      pageId: response.id,
      taskName,
      databaseId
    });
    
    // Update NotionID property with the page ID
    try {
      await withRetry(() =>
        client.pages.update({
          page_id: response.id,
          properties: {
            NotionID: {
              rich_text: [{ text: { content: response.id } }],
            },
          },
        })
      );
    } catch (updateError: any) {
      console.warn('[addTask] Failed to update NotionID property:', updateError?.message);
      // Don't throw - task was created successfully
    }
    
    return response.id;
  } catch (error: any) {
    console.error('[addTask] Error creating task:', {
      taskName,
      databaseId,
      error: error?.message,
      status: error?.status,
      code: error?.code,
      body: error?.body
    });
    throw error;
  }
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
          or: [
            { property: 'Status', select: { equals: 'to do' } },
            { property: 'Status', select: { equals: 'in progress' } },
          ],
        },
        sorts: [
          { property: 'Priority', direction: 'descending' },
          { property: 'Due Date', direction: 'ascending' },
        ],
        page_size: limit,
      })
    );

    return response.results.map(mapPageToTask);
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
              property: 'Due Date',
              date: {
                on_or_before: tomorrow,
              },
            },
            {
              or: [
                { property: 'Status', select: { equals: 'to do' } },
                { property: 'Status', select: { equals: 'in progress' } },
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

    return response.results.map(mapPageToTask);
  } catch (error) {
    console.error('Error getting today tasks:', error);
    return [];
  }
}

// Note: Shopping is now a separate database, not a category in Tasks
// This function is kept for backward compatibility but should use Shopping database
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
            { property: 'Category', select: { equals: 'shopping' } },
            {
              or: [
                { property: 'Status', select: { equals: 'to do' } },
                { property: 'Status', select: { equals: 'in progress' } },
              ],
            },
          ],
        },
        sorts: [{ property: 'Name', direction: 'ascending' }],
      })
    );

    return response.results.map(mapPageToTask);
  } catch (error) {
    console.error('Error getting shopping list:', error);
    return [];
  }
}

// Helper function to normalize priority value (convert old to new format)
function normalizePriority(priority: string): 'low' | 'normal' | 'high' | 'urgent' {
  const normalized = priority.toLowerCase();
  if (normalized === 'medium') return 'normal';
  if (['low', 'normal', 'high', 'urgent'].includes(normalized)) {
    return normalized as 'low' | 'normal' | 'high' | 'urgent';
  }
  return 'normal';
}

// Helper function to normalize status value
function normalizeStatus(status: string): 'to do' | 'in progress' | 'done' {
  const normalized = status.toLowerCase();
  if (normalized === 'to do' || normalized === 'todo' || normalized === 'to-do') return 'to do';
  if (normalized === 'in progress' || normalized === 'in-progress' || normalized === 'doing') return 'in progress';
  if (normalized === 'done' || normalized === 'complete' || normalized === 'completed' || normalized === 'finished') return 'done';
  return 'to do';
}

// Helper function to normalize category value
function normalizeCategory(category: string): 'work' | 'personal' | 'shopping' | 'fitness' | 'health' | 'notes' | 'general' {
  const normalized = category.toLowerCase();
  const validCategories: Array<'work' | 'personal' | 'shopping' | 'fitness' | 'health' | 'notes' | 'general'> = 
    ['work', 'personal', 'shopping', 'fitness', 'health', 'notes', 'general'];
  if (validCategories.includes(normalized as any)) {
    return normalized as any;
  }
  return 'personal';
}

// Helper function to map page to NotionTask
function mapPageToTask(page: any): NotionTask {
  const props = page.properties;
  const priorityRaw = props.Priority?.select?.name || 'normal';
  const statusRaw = props.Status?.select?.name || 'to do';
  const categoryRaw = props.Category?.select?.name || 'personal';
  
  return {
    id: page.id,
    name: props.Name?.title?.[0]?.plain_text || 'Untitled',
    priority: normalizePriority(priorityRaw),
    dueDate: props['Due Date']?.date?.start || null,
    status: normalizeStatus(statusRaw),
    category: normalizeCategory(categoryRaw),
    notes: props.Notes?.rich_text?.[0]?.plain_text || null,
    tags: props.Tags?.multi_select?.map((tag: any) => tag.name) || [],
    recurring: normalizeRecurring(props.Recurring?.select?.name || 'none'),
    completedAt: props['Completed At']?.date?.start || null,
    createdAt: props['Created At']?.created_time || null,
    notionId: props.NotionID?.rich_text?.[0]?.plain_text || page.id,
  };
}

function normalizeRecurring(recurring: string): 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' {
  const normalized = recurring.toLowerCase();
  const valid: Array<'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'> = ['none', 'daily', 'weekly', 'monthly', 'yearly'];
  if (valid.includes(normalized as any)) return normalized as any;
  return 'none';
}

/**
 * Get all tasks (excluding done/completed)
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
          or: [
            { property: 'Status', select: { equals: 'to do' } },
            { property: 'Status', select: { equals: 'in progress' } },
          ],
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
  priority: 'low' | 'normal' | 'high' | 'urgent'
): Promise<NotionTask[]> {
  try {
    const normalizedPriority = normalizePriority(priority);
    const response = await withRetry(() =>
      client.databases.query({
        database_id: databaseId,
        filter: {
          property: 'Priority',
          select: { equals: normalizedPriority },
        },
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
  status: 'to do' | 'in progress' | 'done'
): Promise<NotionTask[]> {
  try {
    const normalizedStatus = normalizeStatus(status);
    const response = await withRetry(() =>
      client.databases.query({
        database_id: databaseId,
        filter: {
          property: 'Status',
          select: { equals: normalizedStatus },
        },
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
  category: 'work' | 'personal' | 'shopping' | 'fitness' | 'health' | 'notes' | 'general'
): Promise<NotionTask[]> {
  try {
    const normalizedCategory = normalizeCategory(category);
    const response = await withRetry(() =>
      client.databases.query({
        database_id: databaseId,
        filter: {
          property: 'Category',
          select: { equals: normalizedCategory },
        },
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
 * Get pending tasks (to do or in progress)
 */
export async function getPendingTasks(
  client: Client,
  databaseId: string
): Promise<NotionTask[]> {
  try {
    const response = await withRetry(() =>
      client.databases.query({
        database_id: databaseId,
        filter: {
          or: [
            { property: 'Status', select: { equals: 'to do' } },
            { property: 'Status', select: { equals: 'in progress' } },
          ],
        },
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
        filter: {
          and: [
            {
              property: 'Due Date',
              date: { before: today },
            },
            {
              or: [
                { property: 'Status', select: { equals: 'to do' } },
                { property: 'Status', select: { equals: 'in progress' } },
              ],
            },
          ],
        },
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
        filter: {
          property: 'Due Date',
          date: { equals: tomorrow },
        },
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
/**
 * Get tasks by date range
 */
export async function getTasksByDate(
  client: Client,
  databaseId: string,
  date: string
): Promise<NotionTask[]> {
  try {
    const response = await withRetry(() =>
      client.databases.query({
        database_id: databaseId,
        filter: {
          property: 'Due Date',
          date: { equals: date },
        },
        sorts: [
          { property: 'Priority', direction: 'descending' },
        ],
      })
    );
    return response.results.map(mapPageToTask);
  } catch (error) {
    console.error('Error getting tasks by date:', error);
    return [];
  }
}

/**
 * Get tasks due this week
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
        filter: {
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
        },
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
      select: { equals: 'done' },
    };

    if (timeRange) {
      filter = {
        and: [
          { property: 'Status', select: { equals: 'done' } },
          {
            property: 'Due Date',
            date: {
              on_or_after: timeRange.start,
              on_or_before: timeRange.end,
            },
          },
        ],
      };
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
 * Get tasks by date range (alias for getTasksByDate)
 */
export async function getTasksByDateRange(
  client: Client,
  databaseId: string,
  date: string
): Promise<NotionTask[]> {
  return getTasksByDate(client, databaseId, date);
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
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  dueDate?: string;
  category?: 'work' | 'personal' | 'shopping' | 'fitness' | 'health' | 'notes' | 'general';
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
} {
  const lowerUtterance = utterance.toLowerCase().trim();
  let taskName = utterance.trim();
  let priority: 'low' | 'normal' | 'high' | 'urgent' | undefined;
  let dueDate: string | undefined;
  let category: 'work' | 'personal' | 'shopping' | 'fitness' | 'health' | 'notes' | 'general' | undefined;
  let recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | undefined;

  // First, remove common prefixes
  taskName = taskName.replace(/^(add|remind me to|remind me)\s+/i, '').trim();

  // Parse priority (must check before removing other parts)
  if (lowerUtterance.includes('urgent') || lowerUtterance.includes('asap')) {
    priority = 'urgent';
    taskName = taskName.replace(/\b(urgent|asap)\b/gi, '').trim();
  } else if (lowerUtterance.includes('high priority') || lowerUtterance.includes('high')) {
    priority = 'high';
    taskName = taskName.replace(/\b(high\s+priority|high)\b/gi, '').trim();
  } else if (lowerUtterance.includes('low priority') || lowerUtterance.includes('low')) {
    priority = 'low';
    taskName = taskName.replace(/\b(low\s+priority|low)\b/gi, '').trim();
  }

  // Parse recurrence
  if (lowerUtterance.includes('daily') || lowerUtterance.includes('every day')) {
    recurrence = 'daily';
    taskName = taskName.replace(/\b(daily|every\s+day)\b/gi, '').trim();
  } else if (lowerUtterance.includes('weekly') || lowerUtterance.includes('every week')) {
    recurrence = 'weekly';
    taskName = taskName.replace(/\b(weekly|every\s+week)\b/gi, '').trim();
  } else if (lowerUtterance.includes('monthly') || lowerUtterance.includes('every month')) {
    recurrence = 'monthly';
    taskName = taskName.replace(/\b(monthly|every\s+month)\b/gi, '').trim();
  } else if (lowerUtterance.includes('yearly') || lowerUtterance.includes('every year')) {
    recurrence = 'yearly';
    taskName = taskName.replace(/\b(yearly|every\s+year)\b/gi, '').trim();
  }

  // Parse category (be more specific to avoid false matches)
  if (lowerUtterance.match(/\b(work\s+task|to\s+work|work:)\b/)) {
    category = 'work';
    taskName = taskName.replace(/\b(work\s+task|to\s+work|work:)\b/gi, '').trim();
  } else if (lowerUtterance.match(/\b(fitness|workout|to\s+fitness|fitness:)\b/)) {
    category = 'fitness';
    taskName = taskName.replace(/\b(fitness|workout|to\s+fitness|fitness:)\b/gi, '').trim();
  } else if (lowerUtterance.match(/\b(to\s+shopping|shopping|shopping\s+list)\b/)) {
    category = 'shopping';
    taskName = taskName.replace(/\b(to\s+shopping|shopping|shopping\s+list)\b/gi, '').trim();
  } else if (lowerUtterance.match(/\b(health|medical|doctor)\b/)) {
    category = 'health';
    taskName = taskName.replace(/\b(health|medical|doctor)\b/gi, '').trim();
  } else if (lowerUtterance.match(/\b(notes|journal)\b/)) {
    category = 'notes';
    taskName = taskName.replace(/\b(notes|journal)\b/gi, '').trim();
  } else if (lowerUtterance.match(/\b(personal|to\s+personal|personal:)\b/)) {
    category = 'personal';
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

  return { taskName, priority, dueDate, category, recurrence };
}

/**
 * Update task status
 */
export async function updateTaskStatus(
  client: Client,
  pageId: string,
  status: 'to do' | 'in progress' | 'done'
): Promise<void> {
  const normalizedStatus = normalizeStatus(status);
  const now = new Date().toISOString();
  
  const properties: any = {
    Status: {
      select: { name: normalizedStatus },
    },
  };

  // Set Completed At when marking as done
  if (normalizedStatus === 'done') {
    properties['Completed At'] = {
      date: { start: now.split('T')[0] },
    };
  }

  await withRetry(() =>
    client.pages.update({
      page_id: pageId,
      properties,
    })
  );
}

export async function markTaskComplete(
  client: Client,
  pageId: string
): Promise<void> {
  await updateTaskStatus(client, pageId, 'done');
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
 * Delete task (soft delete - mark as done, or hard delete the page)
 */
export async function deleteTask(
  client: Client,
  pageId: string,
  hardDelete: boolean = false
): Promise<void> {
  if (hardDelete) {
    // Actually delete the page from Notion
    await withRetry(() =>
      client.pages.update({
        page_id: pageId,
        archived: true,
      })
    );
  } else {
    // Soft delete - mark as done
    await updateTaskStatus(client, pageId, 'done');
  }
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
  energyLevel: number, // 1-10
  date?: string,
  entry?: string
): Promise<string> {
  const logDate = date || new Date().toISOString().split('T')[0];

  const response = await withRetry(() =>
    client.pages.create({
      parent: { database_id: databaseId },
      properties: {
        Entry: {
          title: [{ text: { content: entry || `Energy ${energyLevel}` } }],
        },
        EnergyLevel: {
          number: energyLevel,
        },
        Date: {
          date: { start: logDate },
        },
        NotionID: {
          rich_text: [{ text: { content: '' } }], // Will be updated after creation
        },
      },
    })
  );

  // Update NotionID
  try {
    await withRetry(() =>
      client.pages.update({
        page_id: response.id,
        properties: {
          NotionID: {
            rich_text: [{ text: { content: response.id } }],
          },
        },
      })
    );
  } catch (updateError: any) {
    console.warn('[logEnergy] Failed to update NotionID:', updateError?.message);
  }

  return response.id;
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
 * Create a Notion Data page in the user's workspace
 */
export async function createPrivacyPage(client: Client): Promise<string | null> {
  try {
    // First, try to find if Notion Data page already exists
    const searchResponse = await withRetry(() =>
      client.search({
        query: 'Notion Data',
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
        return title === 'Notion Data';
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

    // Create new Notion Data page as child of workspace page
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
                content: 'Notion Data',
              },
            },
          ],
        },
      })
    );

    return pageResponse.id;
  } catch (error) {
    console.error('Error creating Notion Data page:', error);
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
 * Complete Notion setup for a user (DEPRECATED - use web-login/app/api/oauth/notion-setup.ts instead)
 * This function is kept for backward compatibility but should not be used in new code.
 * The main setup happens in web-login/app/api/oauth/notion-setup.ts
 */
// ============================================================================
// SHOPPING DATABASE FUNCTIONS
// ============================================================================

export async function addShoppingItem(
  client: Client,
  databaseId: string,
  name: string,
  quantity?: number
): Promise<string> {
  const properties: any = {
    Name: {
      title: [{ text: { content: name } }],
    },
    Status: {
      select: { name: 'needed' },
    },
    'Added At': {
      created_time: new Date().toISOString(),
    },
    NotionID: {
      rich_text: [{ text: { content: '' } }],
    },
  };

  if (quantity !== undefined) {
    properties.Quantity = {
      number: quantity,
    };
  }

  const response = await withRetry(() =>
    client.pages.create({
      parent: { database_id: databaseId },
      properties,
    })
  );

  // Update NotionID
  try {
    await withRetry(() =>
      client.pages.update({
        page_id: response.id,
        properties: {
          NotionID: {
            rich_text: [{ text: { content: response.id } }],
          },
        },
      })
    );
  } catch (updateError: any) {
    console.warn('[addShoppingItem] Failed to update NotionID:', updateError?.message);
  }

  return response.id;
}

export async function getShoppingItems(
  client: Client,
  databaseId: string,
  status?: 'needed' | 'bought'
): Promise<NotionShoppingItem[]> {
  try {
    let filter: any = {};
    if (status) {
      filter = {
        property: 'Status',
        select: { equals: status },
      };
    }

    const response = await withRetry(() =>
      client.databases.query({
        database_id: databaseId,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        sorts: [{ property: 'Added At', direction: 'descending' }],
      })
    );

    return response.results.map((page: any) => {
      const props = page.properties;
      return {
        id: page.id,
        name: props.Name?.title?.[0]?.plain_text || 'Untitled',
        quantity: props.Quantity?.number || undefined,
        status: (props.Status?.select?.name || 'needed') as 'needed' | 'bought',
        addedAt: props['Added At']?.created_time || undefined,
        notes: props.Notes?.rich_text?.[0]?.plain_text || null,
        notionId: props.NotionID?.rich_text?.[0]?.plain_text || page.id,
      };
    });
  } catch (error) {
    console.error('Error getting shopping items:', error);
    return [];
  }
}

export async function markShoppingItemBought(
  client: Client,
  pageId: string
): Promise<void> {
  await withRetry(() =>
    client.pages.update({
      page_id: pageId,
      properties: {
        Status: {
          select: { name: 'bought' },
        },
      },
    })
  );
}

// ============================================================================
// WORKOUTS DATABASE FUNCTIONS
// ============================================================================

export async function addWorkout(
  client: Client,
  databaseId: string,
  workoutType: string,
  duration?: number,
  caloriesBurned?: number,
  date?: string
): Promise<string> {
  const workoutDate = date || new Date().toISOString().split('T')[0];

  const properties: any = {
    Workout: {
      title: [{ text: { content: workoutType } }],
    },
    Date: {
      date: { start: workoutDate },
    },
    NotionID: {
      rich_text: [{ text: { content: '' } }],
    },
  };

  if (duration !== undefined) {
    properties['Duration (min)'] = {
      number: duration,
    };
  }

  if (caloriesBurned !== undefined) {
    properties['Calories Burned'] = {
      number: caloriesBurned,
    };
  }

  const response = await withRetry(() =>
    client.pages.create({
      parent: { database_id: databaseId },
      properties,
    })
  );

  // Update NotionID
  try {
    await withRetry(() =>
      client.pages.update({
        page_id: response.id,
        properties: {
          NotionID: {
            rich_text: [{ text: { content: response.id } }],
          },
        },
      })
    );
  } catch (updateError: any) {
    console.warn('[addWorkout] Failed to update NotionID:', updateError?.message);
  }

  return response.id;
}

export async function getWorkouts(
  client: Client,
  databaseId: string,
  date?: string
): Promise<NotionWorkout[]> {
  try {
    let filter: any = {};
    if (date) {
      filter = {
        property: 'Date',
        date: { equals: date },
      };
    }

    const response = await withRetry(() =>
      client.databases.query({
        database_id: databaseId,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        sorts: [{ property: 'Date', direction: 'descending' }],
      })
    );

    return response.results.map((page: any) => {
      const props = page.properties;
      return {
        id: page.id,
        workout: props.Workout?.title?.[0]?.plain_text || 'Untitled',
        date: props.Date?.date?.start || '',
        duration: props['Duration (min)']?.number || undefined,
        caloriesBurned: props['Calories Burned']?.number || undefined,
        notes: props.Notes?.rich_text?.[0]?.plain_text || null,
        notionId: props.NotionID?.rich_text?.[0]?.plain_text || page.id,
      };
    });
  } catch (error) {
    console.error('Error getting workouts:', error);
    return [];
  }
}

// ============================================================================
// MEALS DATABASE FUNCTIONS
// ============================================================================

export async function addMeal(
  client: Client,
  databaseId: string,
  mealName: string,
  calories: number,
  date?: string
): Promise<string> {
  const mealDate = date || new Date().toISOString().split('T')[0];

  const properties: any = {
    Meal: {
      title: [{ text: { content: mealName } }],
    },
    Calories: {
      number: calories,
    },
    Date: {
      date: { start: mealDate },
    },
    NotionID: {
      rich_text: [{ text: { content: '' } }],
    },
  };

  const response = await withRetry(() =>
    client.pages.create({
      parent: { database_id: databaseId },
      properties,
    })
  );

  // Update NotionID
  try {
    await withRetry(() =>
      client.pages.update({
        page_id: response.id,
        properties: {
          NotionID: {
            rich_text: [{ text: { content: response.id } }],
          },
        },
      })
    );
  } catch (updateError: any) {
    console.warn('[addMeal] Failed to update NotionID:', updateError?.message);
  }

  return response.id;
}

export async function getMeals(
  client: Client,
  databaseId: string,
  date?: string
): Promise<NotionMeal[]> {
  try {
    let filter: any = {};
    if (date) {
      filter = {
        property: 'Date',
        date: { equals: date },
      };
    }

    const response = await withRetry(() =>
      client.databases.query({
        database_id: databaseId,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        sorts: [{ property: 'Date', direction: 'descending' }],
      })
    );

    return response.results.map((page: any) => {
      const props = page.properties;
      return {
        id: page.id,
        meal: props.Meal?.title?.[0]?.plain_text || 'Untitled',
        calories: props.Calories?.number || 0,
        date: props.Date?.date?.start || '',
        notes: props.Notes?.rich_text?.[0]?.plain_text || null,
        notionId: props.NotionID?.rich_text?.[0]?.plain_text || page.id,
      };
    });
  } catch (error) {
    console.error('Error getting meals:', error);
    return [];
  }
}

// ============================================================================
// NOTES DATABASE FUNCTIONS
// ============================================================================

export async function addNote(
  client: Client,
  databaseId: string,
  title: string,
  content: string,
  date?: string,
  tags?: string[]
): Promise<string> {
  const noteDate = date || new Date().toISOString().split('T')[0];

  const properties: any = {
    Title: {
      title: [{ text: { content: title } }],
    },
    Content: {
      rich_text: [{ text: { content: content } }],
    },
    Date: {
      date: { start: noteDate },
    },
    NotionID: {
      rich_text: [{ text: { content: '' } }],
    },
  };

  if (tags && tags.length > 0) {
    properties.Tags = {
      multi_select: tags.map(tag => ({ name: tag })),
    };
  }

  const response = await withRetry(() =>
    client.pages.create({
      parent: { database_id: databaseId },
      properties,
    })
  );

  // Update NotionID
  try {
    await withRetry(() =>
      client.pages.update({
        page_id: response.id,
        properties: {
          NotionID: {
            rich_text: [{ text: { content: response.id } }],
          },
        },
      })
    );
  } catch (updateError: any) {
    console.warn('[addNote] Failed to update NotionID:', updateError?.message);
  }

  return response.id;
}

export async function getNotes(
  client: Client,
  databaseId: string,
  date?: string
): Promise<NotionNote[]> {
  try {
    let filter: any = {};
    if (date) {
      filter = {
        property: 'Date',
        date: { equals: date },
      };
    }

    const response = await withRetry(() =>
      client.databases.query({
        database_id: databaseId,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        sorts: [{ property: 'Date', direction: 'descending' }],
      })
    );

    return response.results.map((page: any) => {
      const props = page.properties;
      return {
        id: page.id,
        title: props.Title?.title?.[0]?.plain_text || 'Untitled',
        content: props.Content?.rich_text?.map((r: any) => r.plain_text).join('') || '',
        date: props.Date?.date?.start || '',
        tags: props.Tags?.multi_select?.map((tag: any) => tag.name) || [],
        notionId: props.NotionID?.rich_text?.[0]?.plain_text || page.id,
      };
    });
  } catch (error) {
    console.error('Error getting notes:', error);
    return [];
  }
}

// ============================================================================
// TASK STATISTICS FUNCTIONS
// ============================================================================

export async function getTaskCount(
  client: Client,
  databaseId: string,
  status?: 'to do' | 'in progress' | 'done'
): Promise<number> {
  try {
    let filter: any = {};
    if (status) {
      filter = {
        property: 'Status',
        select: { equals: normalizeStatus(status) },
      };
    } else {
      // Count all non-done tasks
      filter = {
        or: [
          { property: 'Status', select: { equals: 'to do' } },
          { property: 'Status', select: { equals: 'in progress' } },
        ],
      };
    }

    const response = await withRetry(() =>
      client.databases.query({
        database_id: databaseId,
        filter,
        page_size: 1, // We only need the count
      })
    );

    // Get total count by paginating through all results
    let total = response.results.length;
    let nextCursor: string | null = response.next_cursor;

    while (nextCursor) {
      const nextResponse = await withRetry(() =>
        client.databases.query({
          database_id: databaseId,
          filter,
          start_cursor: nextCursor!,
        })
      );
      total += nextResponse.results.length;
      nextCursor = nextResponse.next_cursor;
    }

    return total;
  } catch (error) {
    console.error('Error getting task count:', error);
    return 0;
  }
}

export async function getCompletedCount(
  client: Client,
  databaseId: string
): Promise<number> {
  return getTaskCount(client, databaseId, 'done');
}

export async function getNextDeadline(
  client: Client,
  databaseId: string
): Promise<NotionTask | null> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const response = await withRetry(() =>
      client.databases.query({
        database_id: databaseId,
        filter: {
          and: [
            {
              property: 'Due Date',
              date: { on_or_after: today },
            },
            {
              or: [
                { property: 'Status', select: { equals: 'to do' } },
                { property: 'Status', select: { equals: 'in progress' } },
              ],
            },
          ],
        },
        sorts: [
          { property: 'Due Date', direction: 'ascending' },
        ],
        page_size: 1,
      })
    );

    if (response.results.length === 0) {
      return null;
    }

    return mapPageToTask(response.results[0]);
  } catch (error) {
    console.error('Error getting next deadline:', error);
    return null;
  }
}

export async function getSummary(
  client: Client,
  databaseId: string
): Promise<{
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  nextDeadline: NotionTask | null;
}> {
  const [totalTasks, completedTasks, pendingTasks, overdueTasks, nextDeadline] = await Promise.all([
    getTaskCount(client, databaseId),
    getCompletedCount(client, databaseId),
    getTaskCount(client, databaseId), // Pending = total - completed
    getOverdueTasks(client, databaseId).then(tasks => tasks.length),
    getNextDeadline(client, databaseId),
  ]);

  return {
    totalTasks,
    completedTasks,
    pendingTasks: totalTasks - completedTasks,
    overdueTasks,
    nextDeadline,
  };
}

/**
 * DEPRECATED: This function is kept for backward compatibility only.
 * The main Notion setup happens in web-login/app/api/oauth/notion-setup.ts
 * which creates all 6 databases (Tasks, Shopping, Workouts, Meals, Notes, EnergyLogs).
 */
export async function setupNotionWorkspace(
  client: Client
): Promise<{
  privacyPageId: string | null;
  tasksDbId: string | null;
  shoppingDbId: string | null;
  workoutsDbId: string | null;
  mealsDbId: string | null;
  notesDbId: string | null;
  energyLogsDbId: string | null;
}> {
  console.warn('[setupNotionWorkspace] This function is deprecated. Use web-login/app/api/oauth/notion-setup.ts instead.');
  try {
    const privacyPageId = await createPrivacyPage(client);
    if (!privacyPageId) {
      throw new Error('Failed to create Notion Data page');
    }

    const tasksDbId = await createTasksDatabase(client, privacyPageId);
    // Note: Focus_Logs database is deprecated and no longer created
    const energyLogsDbId = await createEnergyLogsDatabase(client, privacyPageId);

    return {
      privacyPageId,
      tasksDbId: tasksDbId || null,
      shoppingDbId: null, // Not created in this deprecated function - use notion-setup.ts
      workoutsDbId: null,
      mealsDbId: null,
      notesDbId: null,
      energyLogsDbId: energyLogsDbId || null,
    };
  } catch (error) {
    console.error('Error setting up Notion workspace:', error);
    return {
      privacyPageId: null,
      tasksDbId: null,
      shoppingDbId: null,
      workoutsDbId: null,
      mealsDbId: null,
      notesDbId: null,
      energyLogsDbId: null,
    };
  }
}

