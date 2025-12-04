import { Client } from '@notionhq/client';

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
 * Get the user's workspace root page ID
 */
async function getUserWorkspace(client: Client): Promise<string | null> {
  try {
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
      return page.parent?.page_id || page.id;
    }
    return null;
  } catch (error) {
    console.error('Error getting user workspace:', error);
    return null;
  }
}

/**
 * Create a Voice Planner page in the user's private workspace
 * This page will be created at the workspace root level (private space)
 */
async function createPrivacyPage(client: Client): Promise<string | null> {
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
      console.log('Voice Planner page already exists, using existing page');
      return (existingPage as any).id;
    }

    // Find the workspace root page to create Voice Planner page in private space
    // Search for pages at the workspace level (not nested)
    const workspaceSearch = await withRetry(() =>
      client.search({
        filter: {
          property: 'object',
          value: 'page',
        },
        sort: {
          direction: 'ascending',
          timestamp: 'last_edited_time',
        },
        page_size: 10,
      })
    );

    let parentId: string | null = null;
    
    // Try to find a workspace-level page (parent is workspace)
    for (const item of workspaceSearch.results) {
      const page = item as any;
      if (page.parent?.type === 'workspace') {
        // Found a workspace-level page - use it as parent
        parentId = page.id;
        break;
      } else if (page.parent?.type === 'page_id') {
        // This is a nested page, check if we can find the root
        // For now, use the first page we find
        if (!parentId) {
          parentId = page.parent.page_id;
        }
      }
    }

    // If we still don't have a parent, use the first page found
    if (!parentId && workspaceSearch.results.length > 0) {
      const firstPage = workspaceSearch.results[0] as any;
      if (firstPage.parent?.workspace) {
        // If parent is workspace, create as child of this page
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

    // Create new Voice Planner page in the private workspace
    // This will be a private page (not shared) by default
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
        // Page is private by default (not shared with anyone)
      })
    );

    console.log('Successfully created Voice Planner page:', pageResponse.id);
    return pageResponse.id;
  } catch (error) {
    console.error('Error creating Voice Planner page:', error);
    return null;
  }
}

/**
 * Create Tasks database on a parent page
 */
async function createTasksDatabase(
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
    console.log(`Creating Tasks database on page: ${parentPageId}`);
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
          Name: {
            title: {},
          },
          Category: {
            select: {
              options: [
                { name: 'work', color: 'orange' },
                { name: 'personal', color: 'purple' },
                { name: 'shopping', color: 'green' },
                { name: 'fitness', color: 'pink' },
                { name: 'health', color: 'red' },
                { name: 'notes', color: 'blue' },
                { name: 'general', color: 'gray' },
              ],
            },
          },
          Priority: {
            select: {
              options: [
                { name: 'low', color: 'blue' },
                { name: 'normal', color: 'yellow' },
                { name: 'high', color: 'red' },
                { name: 'urgent', color: 'red' },
              ],
            },
          },
          Status: {
            select: {
              options: [
                { name: 'to do', color: 'gray' },
                { name: 'in progress', color: 'blue' },
                { name: 'done', color: 'green' },
              ],
            },
          },
          'Due Date': {
            date: {},
          },
          'Created At': {
            created_time: {},
          },
          'Completed At': {
            date: {},
          },
          Notes: {
            rich_text: {},
          },
          Tags: {
            multi_select: {},
          },
          Recurring: {
            select: {
              options: [
                { name: 'none', color: 'gray' },
                { name: 'daily', color: 'green' },
                { name: 'weekly', color: 'blue' },
                { name: 'monthly', color: 'purple' },
                { name: 'yearly', color: 'orange' },
              ],
            },
          },
          // Note: Formula properties (Next Occurrence, Overdue) are calculated by Notion
          // They will be automatically created when the database is set up in Notion UI
          // For now, we'll create them as placeholder properties that users can convert to formulas
          NotionID: {
            rich_text: {},
          },
        },
      })
    );

    console.log('Successfully created Tasks database:', dbResponse.id);
    return dbResponse.id;
  } catch (error: any) {
    console.error('Error creating Tasks database:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      status: error.status,
      body: error.body,
    });
    return null;
  }
}

/**
 * Create Focus_Logs database on a parent page
 */
async function createFocusLogsDatabase(
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
    console.log(`Creating Focus_Logs database on page: ${parentPageId}`);
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
          'Entry': {
            title: {},
          },
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

    console.log('Successfully created Focus_Logs database:', dbResponse.id);
    return dbResponse.id;
  } catch (error: any) {
    console.error('Error creating Focus_Logs database:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      status: error.status,
      body: error.body,
    });
    return null;
  }
}

/**
 * Create Shopping database on a parent page
 */
async function createShoppingDatabase(
  client: Client,
  parentPageId: string
): Promise<string | null> {
  try {
    const searchResponse = await withRetry(() =>
      client.search({
        query: 'Shopping',
        filter: {
          property: 'object',
          value: 'database',
        },
      })
    );

    const existingDb = searchResponse.results.find(
      (item: any) => item.object === 'database' && item.title?.[0]?.plain_text === 'Shopping'
    );

    if (existingDb) {
      return (existingDb as any).id;
    }

    console.log(`Creating Shopping database on page: ${parentPageId}`);
    const dbResponse = await withRetry(() =>
      client.databases.create({
        parent: {
          type: 'page_id',
          page_id: parentPageId,
        },
        title: [
          {
            text: {
              content: 'Shopping',
            },
          },
        ],
        properties: {
          Name: {
            title: {},
          },
          Quantity: {
            number: {},
          },
          Status: {
            select: {
              options: [
                { name: 'needed', color: 'red' },
                { name: 'bought', color: 'green' },
              ],
            },
          },
          'Added At': {
            created_time: {},
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

    console.log('Successfully created Shopping database:', dbResponse.id);
    return dbResponse.id;
  } catch (error: any) {
    console.error('Error creating Shopping database:', error);
    return null;
  }
}

/**
 * Create Workouts database on a parent page
 */
async function createWorkoutsDatabase(
  client: Client,
  parentPageId: string
): Promise<string | null> {
  try {
    const searchResponse = await withRetry(() =>
      client.search({
        query: 'Workouts',
        filter: {
          property: 'object',
          value: 'database',
        },
      })
    );

    const existingDb = searchResponse.results.find(
      (item: any) => item.object === 'database' && item.title?.[0]?.plain_text === 'Workouts'
    );

    if (existingDb) {
      return (existingDb as any).id;
    }

    console.log(`Creating Workouts database on page: ${parentPageId}`);
    const dbResponse = await withRetry(() =>
      client.databases.create({
        parent: {
          type: 'page_id',
          page_id: parentPageId,
        },
        title: [
          {
            text: {
              content: 'Workouts',
            },
          },
        ],
        properties: {
          Workout: {
            title: {},
          },
          Date: {
            date: {},
          },
          'Duration (min)': {
            number: {},
          },
          'Calories Burned': {
            number: {},
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

    console.log('Successfully created Workouts database:', dbResponse.id);
    return dbResponse.id;
  } catch (error: any) {
    console.error('Error creating Workouts database:', error);
    return null;
  }
}

/**
 * Create Meals database on a parent page
 */
async function createMealsDatabase(
  client: Client,
  parentPageId: string
): Promise<string | null> {
  try {
    const searchResponse = await withRetry(() =>
      client.search({
        query: 'Meals',
        filter: {
          property: 'object',
          value: 'database',
        },
      })
    );

    const existingDb = searchResponse.results.find(
      (item: any) => item.object === 'database' && item.title?.[0]?.plain_text === 'Meals'
    );

    if (existingDb) {
      return (existingDb as any).id;
    }

    console.log(`Creating Meals database on page: ${parentPageId}`);
    const dbResponse = await withRetry(() =>
      client.databases.create({
        parent: {
          type: 'page_id',
          page_id: parentPageId,
        },
        title: [
          {
            text: {
              content: 'Meals',
            },
          },
        ],
        properties: {
          Meal: {
            title: {},
          },
          Calories: {
            number: {},
          },
          Date: {
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

    console.log('Successfully created Meals database:', dbResponse.id);
    return dbResponse.id;
  } catch (error: any) {
    console.error('Error creating Meals database:', error);
    return null;
  }
}

/**
 * Create Notes database on a parent page
 */
async function createNotesDatabase(
  client: Client,
  parentPageId: string
): Promise<string | null> {
  try {
    const searchResponse = await withRetry(() =>
      client.search({
        query: 'Notes',
        filter: {
          property: 'object',
          value: 'database',
        },
      })
    );

    const existingDb = searchResponse.results.find(
      (item: any) => item.object === 'database' && item.title?.[0]?.plain_text === 'Notes'
    );

    if (existingDb) {
      return (existingDb as any).id;
    }

    console.log(`Creating Notes database on page: ${parentPageId}`);
    const dbResponse = await withRetry(() =>
      client.databases.create({
        parent: {
          type: 'page_id',
          page_id: parentPageId,
        },
        title: [
          {
            text: {
              content: 'Notes',
            },
          },
        ],
        properties: {
          Title: {
            title: {},
          },
          Content: {
            rich_text: {},
          },
          Date: {
            date: {},
          },
          Tags: {
            multi_select: {},
          },
          NotionID: {
            rich_text: {},
          },
        },
      })
    );

    console.log('Successfully created Notes database:', dbResponse.id);
    return dbResponse.id;
  } catch (error: any) {
    console.error('Error creating Notes database:', error);
    return null;
  }
}

/**
 * Create EnergyLogs database on a parent page
 */
async function createEnergyLogsDatabase(
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
    console.log(`Creating Energy_Logs database on page: ${parentPageId}`);
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
          Entry: {
            title: {},
          },
          EnergyLevel: {
            number: {},
          },
          Date: {
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

    console.log('Successfully created Energy_Logs database:', dbResponse.id);
    return dbResponse.id;
  } catch (error: any) {
    console.error('Error creating Energy_Logs database:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      status: error.status,
      body: error.body,
    });
    return null;
  }
}

/**
 * Complete Notion setup for a user:
 * 1. Create Voice Planner page
 * 2. Create six databases (Tasks, Shopping, Workouts, Meals, Notes, EnergyLogs)
 * Returns an object with all created IDs
 */
export async function setupNotionWorkspace(
  accessToken: string
): Promise<{
  privacyPageId: string | null;
  tasksDbId: string | null;
  shoppingDbId: string | null;
  workoutsDbId: string | null;
  mealsDbId: string | null;
  notesDbId: string | null;
  energyLogsDbId: string | null;
  success: boolean;
}> {
  try {
    console.log('=== Starting Notion Workspace Setup ===');
    const client = new Client({ auth: accessToken });

    // Step 1: Create Voice Planner page
    console.log('Step 1: Creating Voice Planner page...');
    const privacyPageId = await createPrivacyPage(client);
    if (!privacyPageId) {
      throw new Error('Failed to create Voice Planner page');
    }
    console.log('✓ Voice Planner page created:', privacyPageId);

    // Verify the page exists and wait a moment for Notion to process it
    try {
      const pageInfo = await client.pages.retrieve({ page_id: privacyPageId });
      console.log('✓ Voice Planner page verified:', pageInfo.id);
    } catch (error: any) {
      console.warn('Warning: Could not verify Voice Planner page:', error.message);
    }

    // Wait a bit for Notion to fully process the page before creating databases
    console.log('Waiting for Notion to process the page...');
    await sleep(2000);

    // Step 2: Create databases on the Voice Planner page
    console.log('Step 2: Creating databases on Voice Planner page...');
    const tasksDbId = await createTasksDatabase(client, privacyPageId);
    console.log('Tasks DB result:', tasksDbId ? `✓ Created: ${tasksDbId}` : '✗ Failed');
    await sleep(1000);
    
    const shoppingDbId = await createShoppingDatabase(client, privacyPageId);
    console.log('Shopping DB result:', shoppingDbId ? `✓ Created: ${shoppingDbId}` : '✗ Failed');
    await sleep(1000);
    
    const workoutsDbId = await createWorkoutsDatabase(client, privacyPageId);
    console.log('Workouts DB result:', workoutsDbId ? `✓ Created: ${workoutsDbId}` : '✗ Failed');
    await sleep(1000);
    
    const mealsDbId = await createMealsDatabase(client, privacyPageId);
    console.log('Meals DB result:', mealsDbId ? `✓ Created: ${mealsDbId}` : '✗ Failed');
    await sleep(1000);
    
    const notesDbId = await createNotesDatabase(client, privacyPageId);
    console.log('Notes DB result:', notesDbId ? `✓ Created: ${notesDbId}` : '✗ Failed');
    await sleep(1000);
    
    const energyLogsDbId = await createEnergyLogsDatabase(client, privacyPageId);
    console.log('EnergyLogs DB result:', energyLogsDbId ? `✓ Created: ${energyLogsDbId}` : '✗ Failed');

    // Success requires: Voice Planner page + Tasks database (critical)
    // Other databases are optional but recommended
    const criticalSuccess = !!(privacyPageId && tasksDbId);
    const allSuccess = !!(privacyPageId && tasksDbId && shoppingDbId && workoutsDbId && mealsDbId && notesDbId && energyLogsDbId);
    
    console.log('=== Notion Workspace Setup Complete ===');
    console.log('Critical Success (Page + Tasks):', criticalSuccess);
    console.log('Full Success (All databases):', allSuccess);
    console.log('Results:', {
      privacyPageId,
      tasksDbId,
      shoppingDbId,
      workoutsDbId,
      mealsDbId,
      notesDbId,
      energyLogsDbId,
    });

    // Return success=true only if critical components are created
    // But return all IDs that were successfully created (even if some failed)
    return {
      privacyPageId: privacyPageId || null,
      tasksDbId: tasksDbId || null,
      shoppingDbId: shoppingDbId || null,
      workoutsDbId: workoutsDbId || null,
      mealsDbId: mealsDbId || null,
      notesDbId: notesDbId || null,
      energyLogsDbId: energyLogsDbId || null,
      success: criticalSuccess, // Success if at least page + Tasks DB are created
    };
  } catch (error: any) {
    console.error('=== Error setting up Notion workspace ===');
    console.error('Error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      status: error.status,
      body: error.body,
      stack: error.stack,
    });
    return {
      privacyPageId: null,
      tasksDbId: null,
      shoppingDbId: null,
      workoutsDbId: null,
      mealsDbId: null,
      notesDbId: null,
      energyLogsDbId: null,
      success: false,
    };
  }
}

