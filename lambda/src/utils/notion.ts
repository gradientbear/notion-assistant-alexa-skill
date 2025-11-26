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

