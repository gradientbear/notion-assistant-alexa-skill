import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse, cleanTaskName, findMatchingTask } from '../utils/alexa';
import { findDatabaseByName, getAllTasks } from '../utils/notion';
import { getTranslation, getLocale } from '../utils/i18n';
import { normalizeCategory } from '../utils/normalization';

export class UpdateTaskCategoryHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest 
      ? (handlerInput.requestEnvelope.request as any).intent?.name 
      : null;
    
    return isIntentRequest && intentName === 'UpdateTaskCategoryIntent';
  }

  async handle(handlerInput: HandlerInput) {
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;

    if (!user || !notionClient) {
      return buildResponse(
        handlerInput,
        getTranslation(handlerInput, 'notion_required_update'),
        getTranslation(handlerInput, 'what_would_you_like')
      );
    }

    try {
      const request = handlerInput.requestEnvelope.request as any;
      const slots = request.intent.slots || {};
      
      // Extract values from slots
      const taskName = slots.taskName?.value;
      const category = slots.category?.value;

      if (!taskName || taskName.trim().length === 0) {
        return buildResponse(
          handlerInput,
          getTranslation(handlerInput, 'update_task_prompt'),
          getTranslation(handlerInput, 'update_task_reprompt')
        );
      }

      if (!category || category.trim().length === 0) {
        return buildResponse(
          handlerInput,
          getTranslation(handlerInput, 'update_task_prompt'),
          getTranslation(handlerInput, 'update_task_reprompt')
        );
      }

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

      // Normalize category value
      const normalizedCategory = normalizeCategory(category);

      // Clean task name
      const locale = getLocale(handlerInput);
      let cleanedSlot = taskName;
      cleanedSlot = cleanedSlot.replace(/^the\s+task:\s*/i, '');
      cleanedSlot = cleanedSlot.replace(/^the\s+tasks:\s*/i, '');
      cleanedSlot = cleanedSlot.replace(/^task:\s*/i, '');
      cleanedSlot = cleanedSlot.replace(/^tasks:\s*/i, '');
      const cleanedTaskName = cleanTaskName(cleanedSlot, locale);

      // Get all tasks to find matching task
      const allTasks = await getAllTasks(notionClient, tasksDbId);
      const matchingTask = findMatchingTask(cleanedTaskName, allTasks);
      
      if (!matchingTask) {
        return buildResponse(
          handlerInput,
          getTranslation(handlerInput, 'task_not_found', { taskName: cleanedTaskName }),
          getTranslation(handlerInput, 'what_else')
        );
      }

      // Update category directly via Notion API (updateTask doesn't support category)
      // Use retry logic similar to other update functions
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
      
      await withRetry(() =>
        notionClient.pages.update({
          page_id: matchingTask.id,
          properties: {
            Category: {
              select: { name: normalizedCategory },
            },
          },
        })
      );

      // Build confirmation message
      const categoryText = normalizedCategory === 'WORK' ? 'work' : 'personal';
      const confirmation = getTranslation(handlerInput, 'task_updated', { 
        taskName: matchingTask.name, 
        updates: `category to ${categoryText}`
      });

      return buildResponse(handlerInput, confirmation, getTranslation(handlerInput, 'what_else'));
    } catch (error: any) {
      console.error('[UpdateTaskCategoryHandler] Error updating task category:', error);
      console.error('[UpdateTaskCategoryHandler] Error details:', {
        message: error?.message,
        status: error?.status,
        code: error?.code,
        stack: error?.stack
      });
      return buildResponse(
        handlerInput,
        getTranslation(handlerInput, 'update_task_error'),
        getTranslation(handlerInput, 'what_would_you_like')
      );
    }
  }
}

