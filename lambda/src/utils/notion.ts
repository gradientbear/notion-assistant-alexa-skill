import { Client } from '@notionhq/client';
import { NotionTask } from '../types';

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
    console.log(`[findDatabaseByName] Searching for database: "${databaseName}"`);
    
    const response = await withRetry(() =>
      client.search({
        query: databaseName,
        filter: {
          property: 'object',
          value: 'database',
        },
      })
    );

    console.log(`[findDatabaseByName] Search returned ${response.results.length} results`);
    
    // Try exact match first (case-sensitive)
    let database = response.results.find(
      (item: any) => item.object === 'database' && item.title?.[0]?.plain_text === databaseName
    );
    
    // If no exact match, try case-insensitive
    if (!database) {
      const lowerName = databaseName.toLowerCase();
      database = response.results.find(
        (item: any) => {
          const itemTitle = item.title?.[0]?.plain_text || '';
          return item.object === 'database' && itemTitle.toLowerCase() === lowerName;
        }
      );
    }
    
    // Log all found databases for debugging
    if (response.results.length > 0) {
      console.log('[findDatabaseByName] Found databases:', 
        response.results.map((item: any) => ({
          id: item.id,
          title: item.title?.[0]?.plain_text || 'No title',
          object: item.object
        }))
      );
    }
    
    if (database) {
      const dbId = (database as any).id;
      const dbTitle = (database as any).title?.[0]?.plain_text || 'Unknown';
      console.log(`[findDatabaseByName] ✓ Found database "${dbTitle}" with ID: ${dbId}`);
      return dbId;
    }
    
    console.warn(`[findDatabaseByName] ✗ Database "${databaseName}" not found`);
    return null;
  } catch (error: any) {
    console.error(`[findDatabaseByName] Error finding database "${databaseName}":`, {
      message: error?.message,
      status: error?.status,
      code: error?.code,
      body: error?.body
    });
    return null;
  }
}

export async function addTask(
  client: Client,
  databaseId: string,
  taskName: string,
  parsedName?: string,
  priority: 'LOW' | 'NORMAL' | 'HIGH' = 'NORMAL',
  category: 'PERSONAL' | 'WORK' = 'PERSONAL',
  dueDateTime?: string | null,
  status: 'TO DO' | 'IN_PROCESS' | 'DONE' = 'TO DO'
): Promise<string> {
  const properties: any = {
    'Task Name': {
      title: [{ text: { content: taskName } }],
    },
    'Parsed Name': {
      rich_text: [{ text: { content: parsedName || taskName } }],
    },
    Priority: {
      select: { name: priority },
    },
    Status: {
      select: { name: status },
    },
    Category: {
      select: { name: category },
    },
  };

  if (dueDateTime) {
    properties['Due Date Time'] = {
      date: { start: dueDateTime },
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
      parsedName: parsedName || taskName,
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
            { property: 'Status', select: { equals: 'TO DO' } },
            { property: 'Status', select: { equals: 'IN_PROCESS' } },
          ],
        },
        sorts: [
          { property: 'Priority', direction: 'descending' },
          { property: 'Due Date Time', direction: 'ascending' },
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
              property: 'Due Date Time',
              date: {
                on_or_before: tomorrow,
              },
            },
            {
              or: [
                { property: 'Status', select: { equals: 'TO DO' } },
                { property: 'Status', select: { equals: 'IN_PROCESS' } },
              ],
            },
          ],
        },
        sorts: [
          { property: 'Priority', direction: 'descending' },
          { property: 'Due Date Time', direction: 'ascending' },
        ],
      })
    );

    return response.results.map(mapPageToTask);
  } catch (error) {
    console.error('Error getting today tasks:', error);
    return [];
  }
}


// Helper function to normalize priority value (convert to new format)
function normalizePriority(priority: string): 'LOW' | 'NORMAL' | 'HIGH' {
  const normalized = priority.toUpperCase();
  if (normalized === 'MEDIUM') return 'NORMAL';
  if (['LOW', 'NORMAL', 'HIGH'].includes(normalized)) {
    return normalized as 'LOW' | 'NORMAL' | 'HIGH';
  }
  // Handle old lowercase values
  const lower = priority.toLowerCase();
  if (lower === 'low') return 'LOW';
  if (lower === 'high') return 'HIGH';
  return 'NORMAL';
}

// Helper function to normalize status value
function normalizeStatus(status: string): 'TO DO' | 'IN_PROCESS' | 'DONE' {
  const normalized = status.toUpperCase().replace(/\s+/g, '_');
  if (normalized === 'TO_DO' || normalized === 'TODO' || normalized === 'TO-DO') return 'TO DO';
  if (normalized === 'IN_PROGRESS' || normalized === 'IN-PROGRESS' || normalized === 'DOING') return 'IN_PROCESS';
  if (normalized === 'DONE' || normalized === 'COMPLETE' || normalized === 'COMPLETED' || normalized === 'FINISHED') return 'DONE';
  // Handle old lowercase values
  const lower = status.toLowerCase();
  if (lower === 'to do' || lower === 'todo') return 'TO DO';
  if (lower === 'in progress' || lower === 'doing') return 'IN_PROCESS';
  if (lower === 'done' || lower === 'complete') return 'DONE';
  return 'TO DO';
}

// Helper function to normalize category value
function normalizeCategory(category: string): 'PERSONAL' | 'WORK' {
  const normalized = category.toUpperCase();
  if (normalized === 'WORK') return 'WORK';
  if (normalized === 'PERSONAL') return 'PERSONAL';
  // Handle old lowercase values
  const lower = category.toLowerCase();
  if (lower === 'work') return 'WORK';
  return 'PERSONAL';
}

// Helper function to map page to NotionTask
export function mapPageToTask(page: any): NotionTask {
  const props = page.properties;
  const priorityRaw = props.Priority?.select?.name || 'NORMAL';
  const statusRaw = props.Status?.select?.name || 'TO DO';
  const categoryRaw = props.Category?.select?.name || 'PERSONAL';
  
  return {
    id: page.id,
    name: props['Task Name']?.title?.[0]?.plain_text || 'Untitled',
    parsedName: props['Parsed Name']?.rich_text?.[0]?.plain_text || props['Task Name']?.title?.[0]?.plain_text || 'Untitled',
    priority: normalizePriority(priorityRaw),
    dueDateTime: props['Due Date Time']?.date?.start || null,
    status: normalizeStatus(statusRaw),
    category: normalizeCategory(categoryRaw),
    notes: props.Notes?.rich_text?.[0]?.plain_text || null,
    createdAt: props['Created At']?.created_time || null,
    updatedAt: props['Updated At']?.last_edited_time || null,
    notionId: props.NotionID?.rich_text?.[0]?.plain_text || page.id,
  };
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
            { property: 'Status', select: { equals: 'TO DO' } },
            { property: 'Status', select: { equals: 'IN_PROCESS' } },
          ],
        },
        sorts: [
          { property: 'Priority', direction: 'descending' },
          { property: 'Due Date Time', direction: 'ascending' },
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
  priority: 'LOW' | 'NORMAL' | 'HIGH'
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
          { property: 'Due Date Time', direction: 'ascending' },
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
  status: 'TO DO' | 'IN_PROCESS' | 'DONE'
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
          { property: 'Due Date Time', direction: 'ascending' },
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
  category: 'PERSONAL' | 'WORK'
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
          { property: 'Due Date Time', direction: 'ascending' },
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
            { property: 'Status', select: { equals: 'TO DO' } },
            { property: 'Status', select: { equals: 'IN_PROCESS' } },
          ],
        },
        sorts: [
          { property: 'Priority', direction: 'descending' },
          { property: 'Due Date Time', direction: 'ascending' },
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
              property: 'Due Date Time',
              date: { before: today },
            },
            {
              or: [
                { property: 'Status', select: { equals: 'TO DO' } },
                { property: 'Status', select: { equals: 'IN_PROCESS' } },
              ],
            },
          ],
        },
        sorts: [
          { property: 'Due Date Time', direction: 'ascending' },
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
          property: 'Due Date Time',
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
          property: 'Due Date Time',
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
              property: 'Due Date Time',
              date: { on_or_after: today },
            },
            {
              property: 'Due Date Time',
              date: { on_or_before: nextWeek },
            },
          ],
        },
        sorts: [
          { property: 'Due Date Time', direction: 'ascending' },
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
      select: { equals: 'DONE' },
    };

    if (timeRange) {
      filter = {
        and: [
          { property: 'Status', select: { equals: 'DONE' } },
          {
            property: 'Due Date Time',
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
          { property: 'Due Date Time', direction: 'descending' },
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
 * Update task status
 */
export async function updateTaskStatus(
  client: Client,
  pageId: string,
  status: 'TO DO' | 'IN_PROCESS' | 'DONE'
): Promise<void> {
  const normalizedStatus = normalizeStatus(status);
  
  const properties: any = {
    Status: {
      select: { name: normalizedStatus },
    },
  };

  await withRetry(() =>
    client.pages.update({
      page_id: pageId,
      properties,
    })
  );
}

/**
 * Update task with multiple fields (status, priority, dueDateTime)
 */
export async function updateTask(
  client: Client,
  pageId: string,
  updates: {
    status?: 'TO DO' | 'IN_PROCESS' | 'DONE';
    priority?: 'LOW' | 'NORMAL' | 'HIGH';
    dueDateTime?: string | null;
  }
): Promise<void> {
  const properties: any = {};
  
  if (updates.status !== undefined) {
    properties.Status = {
      select: { name: updates.status },
    };
  }
  
  if (updates.priority !== undefined) {
    properties.Priority = {
      select: { name: updates.priority },
    };
  }
  
  if (updates.dueDateTime !== undefined) {
    if (updates.dueDateTime) {
      properties['Due Date Time'] = {
        date: { start: updates.dueDateTime },
      };
    } else {
      properties['Due Date Time'] = {
        date: null,
      };
    }
  }
  
  if (Object.keys(properties).length === 0) {
    return; // No updates to make
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
  await updateTaskStatus(client, pageId, 'DONE');
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
    await updateTaskStatus(client, pageId, 'DONE');
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
 * Create a Voice Planner page in the user's workspace
 */
export async function createPrivacyPage(client: Client): Promise<string | null> {
  try {
    // First, try to find if Voice Planner page already exists
    const searchResponse = await withRetry(() =>
      client.search({
        query: 'Voice Planner',
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
        return title === 'Voice Planner';
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

    // Create new Voice Planner page as child of workspace page
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
                content: 'Voice Planner',
              },
            },
          ],
        },
      })
    );

    return pageResponse.id;
  } catch (error) {
    console.error('Error creating Voice Planner page:', error);
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
          'Parsed Name': {
            rich_text: {},
          },
          Priority: {
            select: {
              options: [
                { name: 'HIGH', color: 'red' },
                { name: 'NORMAL', color: 'yellow' },
                { name: 'LOW', color: 'blue' },
              ],
            },
          },
          Status: {
            select: {
              options: [
                { name: 'TO DO', color: 'gray' },
                { name: 'IN_PROCESS', color: 'blue' },
                { name: 'DONE', color: 'green' },
              ],
            },
          },
          Category: {
            select: {
              options: [
                { name: 'WORK', color: 'orange' },
                { name: 'PERSONAL', color: 'purple' },
              ],
            },
          },
          'Due Date Time': {
            date: {},
          },
          Notes: {
            rich_text: {},
          },
          NotionID: {
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
 * Complete Notion setup for a user (DEPRECATED - use web-login/app/api/oauth/notion-setup.ts instead)
 * This function is kept for backward compatibility but should not be used in new code.
 * The main setup happens in web-login/app/api/oauth/notion-setup.ts
 */

// ============================================================================
// TASK STATISTICS FUNCTIONS
// ============================================================================

export async function getTaskCount(
  client: Client,
  databaseId: string,
  status?: 'TO DO' | 'IN_PROCESS' | 'DONE'
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
          { property: 'Status', select: { equals: 'TO DO' } },
          { property: 'Status', select: { equals: 'IN_PROCESS' } },
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
  return getTaskCount(client, databaseId, 'DONE');
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
              property: 'Due Date Time',
              date: { on_or_after: today },
            },
            {
              or: [
                { property: 'Status', select: { equals: 'TO DO' } },
                { property: 'Status', select: { equals: 'IN_PROCESS' } },
              ],
            },
          ],
        },
        sorts: [
          { property: 'Due Date Time', direction: 'ascending' },
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
 * which creates the Tasks database.
 */
export async function setupNotionWorkspace(
  client: Client
): Promise<{
  privacyPageId: string | null;
  tasksDbId: string | null;
}> {
  console.warn('[setupNotionWorkspace] This function is deprecated. Use web-login/app/api/oauth/notion-setup.ts instead.');
  try {
    const privacyPageId = await createPrivacyPage(client);
    if (!privacyPageId) {
      throw new Error('Failed to create Voice Planner page');
    }

    const tasksDbId = await createTasksDatabase(client, privacyPageId);

    return {
      privacyPageId,
      tasksDbId: tasksDbId || null
    };
  } catch (error) {
    console.error('Error setting up Notion workspace:', error);
    return {
      privacyPageId: null,
      tasksDbId: null
    };
  }
}

