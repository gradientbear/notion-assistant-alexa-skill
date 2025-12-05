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
 * Complete Notion setup for a user:
 * 1. Create Voice Planner page
 * 2. Create Tasks database
 * Returns an object with created IDs
 */
export async function setupNotionWorkspace(
  accessToken: string
): Promise<{
  privacyPageId: string | null;
  tasksDbId: string | null;
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

    // Step 2: Create Tasks database on the Voice Planner page
    console.log('Step 2: Creating Tasks database on Voice Planner page...');
    const tasksDbId = await createTasksDatabase(client, privacyPageId);
    console.log('Tasks DB result:', tasksDbId ? `✓ Created: ${tasksDbId}` : '✗ Failed');

    // Success requires: Voice Planner page + Tasks database
    const success = !!(privacyPageId && tasksDbId);
    
    console.log('=== Notion Workspace Setup Complete ===');
    console.log('Success:', success);
    console.log('Results:', {
      privacyPageId,
      tasksDbId,
    });

    return {
      privacyPageId: privacyPageId || null,
      tasksDbId: tasksDbId || null,
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
      success: false,
    };
  }
}

