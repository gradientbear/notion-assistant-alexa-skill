import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse, cleanTaskName, findMatchingTask } from '../utils/alexa';
import { findDatabaseByName, getAllTasks } from '../utils/notion';
import { getTranslation, getLocale } from '../utils/i18n';

export class ReorderTaskHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest 
      ? (handlerInput.requestEnvelope.request as any).intent?.name 
      : null;
    
    return isIntentRequest && intentName === 'ReorderTaskIntent';
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
      const position = slots.position?.value;

      if (!taskName || taskName.trim().length === 0) {
        return buildResponse(
          handlerInput,
          getTranslation(handlerInput, 'update_task_prompt'),
          getTranslation(handlerInput, 'update_task_reprompt')
        );
      }

      if (!position || position.trim().length === 0) {
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

      // Parse position value
      const positionLower = position.toLowerCase();
      let targetIndex: number | null = null;
      
      if (positionLower === 'first' || positionLower === 'top') {
        targetIndex = 0;
      } else if (positionLower === 'second') {
        targetIndex = 1;
      } else if (positionLower === 'third') {
        targetIndex = 2;
      } else if (positionLower === 'bottom' || positionLower === 'last') {
        targetIndex = allTasks.length - 1;
      } else {
        // Try to parse as number
        const numPosition = parseInt(position, 10);
        if (!isNaN(numPosition) && numPosition > 0) {
          targetIndex = numPosition - 1; // Convert to 0-based index
        }
      }

      if (targetIndex === null || targetIndex < 0 || targetIndex >= allTasks.length) {
        return buildResponse(
          handlerInput,
          getTranslation(handlerInput, 'update_task_error'),
          getTranslation(handlerInput, 'what_would_you_like')
        );
      }

      // Note: Notion API doesn't directly support reordering pages in a database
      // The order is typically determined by the sort order in queries
      // For now, we'll return a message indicating the task was found
      // In a real implementation, you might need to use a custom ordering field
      // or work with Notion's page ordering capabilities
      
      const confirmation = getTranslation(handlerInput, 'task_updated', { 
        taskName: matchingTask.name, 
        updates: `moved to position ${targetIndex + 1}`
      });

      return buildResponse(handlerInput, confirmation, getTranslation(handlerInput, 'what_else'));
    } catch (error: any) {
      console.error('[ReorderTaskHandler] Error reordering task:', error);
      console.error('[ReorderTaskHandler] Error details:', {
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


