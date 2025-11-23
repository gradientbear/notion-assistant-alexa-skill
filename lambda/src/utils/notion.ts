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
          or: [
            { property: 'Status', select: { equals: 'To Do' } },
            { property: 'Status', select: { equals: 'In Progress' } },
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
      };
    });
  } catch (error) {
    console.error('Error getting shopping list:', error);
    return [];
  }
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

