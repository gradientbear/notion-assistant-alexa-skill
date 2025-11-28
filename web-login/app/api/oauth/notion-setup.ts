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
 * Create a Notion Data page in the user's private workspace
 * This page will be created at the workspace root level (private space)
 */
async function createPrivacyPage(client: Client): Promise<string | null> {
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
      console.log('Notion Data page already exists, using existing page');
      return (existingPage as any).id;
    }

    // Find the workspace root page to create Notion Data page in private space
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

    // Create new Notion Data page in the private workspace
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
                content: 'Notion Data',
              },
            },
          ],
        },
        // Page is private by default (not shared with anyone)
      })
    );

    console.log('Successfully created Notion Data page:', pageResponse.id);
    return pageResponse.id;
  } catch (error) {
    console.error('Error creating Notion Data page:', error);
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
 * Create Energy_Logs database on a parent page
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
          'Entry': {
            title: {},
          },
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
 * 1. Create Notion Data page
 * 2. Create three databases (Tasks, Focus_Logs, Energy_Logs)
 * Returns an object with all created IDs
 */
export async function setupNotionWorkspace(
  accessToken: string
): Promise<{
  privacyPageId: string | null;
  tasksDbId: string | null;
  focusLogsDbId: string | null;
  energyLogsDbId: string | null;
  success: boolean;
}> {
  try {
    console.log('=== Starting Notion Workspace Setup ===');
    const client = new Client({ auth: accessToken });

    // Step 1: Create Notion Data page
    console.log('Step 1: Creating Notion Data page...');
    const privacyPageId = await createPrivacyPage(client);
    if (!privacyPageId) {
      throw new Error('Failed to create Notion Data page');
    }
    console.log('✓ Notion Data page created:', privacyPageId);

    // Verify the page exists and wait a moment for Notion to process it
    try {
      const pageInfo = await client.pages.retrieve({ page_id: privacyPageId });
      console.log('✓ Notion Data page verified:', pageInfo.id);
    } catch (error: any) {
      console.warn('Warning: Could not verify Notion Data page:', error.message);
    }

    // Wait a bit for Notion to fully process the page before creating databases
    console.log('Waiting for Notion to process the page...');
    await sleep(2000);

    // Step 2: Create databases on the Notion Data page
    console.log('Step 2: Creating databases on Notion Data page...');
    const tasksDbId = await createTasksDatabase(client, privacyPageId);
    console.log('Tasks DB result:', tasksDbId ? `✓ Created: ${tasksDbId}` : '✗ Failed');
    
    // Small delay between database creations
    await sleep(1000);
    
    const focusLogsDbId = await createFocusLogsDatabase(client, privacyPageId);
    console.log('Focus_Logs DB result:', focusLogsDbId ? `✓ Created: ${focusLogsDbId}` : '✗ Failed');
    
    // Small delay between database creations
    await sleep(1000);
    
    const energyLogsDbId = await createEnergyLogsDatabase(client, privacyPageId);
    console.log('Energy_Logs DB result:', energyLogsDbId ? `✓ Created: ${energyLogsDbId}` : '✗ Failed');

    const success = !!(privacyPageId && tasksDbId && focusLogsDbId && energyLogsDbId);
    
    console.log('=== Notion Workspace Setup Complete ===');
    console.log('Success:', success);
    console.log('Results:', {
      privacyPageId,
      tasksDbId,
      focusLogsDbId,
      energyLogsDbId,
    });

    return {
      privacyPageId,
      tasksDbId: tasksDbId || null,
      focusLogsDbId: focusLogsDbId || null,
      energyLogsDbId: energyLogsDbId || null,
      success,
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
      focusLogsDbId: null,
      energyLogsDbId: null,
      success: false,
    };
  }
}

