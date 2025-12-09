import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse, cleanTaskName, findMatchingTask } from '../utils/alexa';
import {
  findDatabaseByName,
  getAllTasks,
  getCompletedTasksForDeletion,
  deleteTask,
  deleteTasksBatch,
  deleteCompletedTasks,
} from '../utils/notion';
import { getTranslation, getLocale } from '../utils/i18n';

export class DeleteTaskHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest 
      ? (handlerInput.requestEnvelope.request as any).intent?.name 
      : null;
    const canHandle = isIntentRequest && intentName === 'DeleteTaskIntent';
    
    return canHandle;
  }

  async handle(handlerInput: HandlerInput) {
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;

    if (!user || !notionClient) {
      return buildResponse(
        handlerInput,
        getTranslation(handlerInput, 'notion_required_delete'),
        getTranslation(handlerInput, 'what_would_you_like')
      );
    }

    try {
      const request = handlerInput.requestEnvelope.request as any;
      const slots = request.intent.slots || {};
      
      // Extract userRequest from AMAZON.SearchQuery slot
      const userRequest = slots.userRequest?.value;
      
      if (!userRequest || userRequest.trim().length === 0) {
        return buildResponse(
          handlerInput,
          getTranslation(handlerInput, 'delete_task_prompt'),
          getTranslation(handlerInput, 'delete_task_reprompt')
        );
      }
      
      const taskSlot = userRequest;

      const tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
      if (!tasksDbId) {
        return buildResponse(
          handlerInput,
          getTranslation(handlerInput, 'notion_db_not_found_simple'),
          getTranslation(handlerInput, 'what_would_you_like')
        );
      }

      // Check for batch operations (English and Italian)
      const locale = getLocale(handlerInput);
      const taskValue = taskSlot?.toLowerCase() || '';
      
      if (taskValue.includes('completed') || taskValue.includes('done') ||
          taskValue.includes('completate') || taskValue.includes('fatto')) {
        // Delete all completed tasks
        const deletedCount = await deleteCompletedTasks(notionClient, tasksDbId);
        
        if (deletedCount === 0) {
          return buildResponse(
            handlerInput,
            getTranslation(handlerInput, 'no_completed_tasks'),
            getTranslation(handlerInput, 'what_else')
          );
        }

        return buildResponse(
          handlerInput,
          getTranslation(handlerInput, 'deleted_all_completed'),
          getTranslation(handlerInput, 'what_else')
        );
      }

      // Clean up the task name by removing command words
      const cleanedTaskName = cleanTaskName(taskSlot, locale);
      
      const allTasks = await getAllTasks(notionClient, tasksDbId);

      // Hybrid matching: exact -> word token -> substring
      const matchingTask = findMatchingTask(cleanedTaskName, allTasks);

      if (!matchingTask) {
        return buildResponse(
          handlerInput,
          getTranslation(handlerInput, 'task_not_found', { taskName: cleanedTaskName }),
          getTranslation(handlerInput, 'what_else')
        );
      }

      await deleteTask(notionClient, matchingTask.id);

      return buildResponse(
        handlerInput,
        getTranslation(handlerInput, 'task_deleted', { taskName: matchingTask.name }),
        getTranslation(handlerInput, 'what_else')
      );
    } catch (error) {
      console.error('Error deleting task:', error);
      return buildResponse(
        handlerInput,
        getTranslation(handlerInput, 'delete_task_error'),
        getTranslation(handlerInput, 'what_would_you_like')
      );
    }
  }
}

