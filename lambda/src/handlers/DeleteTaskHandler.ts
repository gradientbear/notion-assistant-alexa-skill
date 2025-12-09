import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse, cleanTaskName, findMatchingTask } from '../utils/alexa';
import {
  findDatabaseByName,
  getAllTasks,
  getCompletedTasksForDeletion,
  deleteTask,
  deleteTasksBatch,
  deleteCompletedTasks,
  deleteAllTasks,
  deleteTasksByStatus,
  deleteTasksByCategory,
  deleteTasksByTimeFilter,
} from '../utils/notion';
import { getTranslation, getLocale } from '../utils/i18n';
import { parseDeletionCondition } from '../utils/parsing';

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
      
      const tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
      if (!tasksDbId) {
        return buildResponse(
          handlerInput,
          getTranslation(handlerInput, 'notion_db_not_found_simple'),
          getTranslation(handlerInput, 'what_would_you_like')
        );
      }

      const locale = getLocale(handlerInput);
      
      // Parse deletion condition to determine what to delete
      const deletionCondition = parseDeletionCondition(userRequest, locale);
      
      // Handle conditional deletion based on type
      if (deletionCondition.type === 'all') {
        // Delete all tasks
        const deletedCount = await deleteAllTasks(notionClient, tasksDbId);
        
        if (deletedCount === 0) {
          return buildResponse(
            handlerInput,
            getTranslation(handlerInput, 'no_tasks_found'),
            getTranslation(handlerInput, 'what_else')
          );
        }

        return buildResponse(
          handlerInput,
          getTranslation(handlerInput, 'deleted_all_tasks', { count: deletedCount.toString() }),
          getTranslation(handlerInput, 'what_else')
        );
      } else if (deletionCondition.type === 'status' && deletionCondition.status) {
        // Delete tasks by status
        const deletedCount = await deleteTasksByStatus(notionClient, tasksDbId, deletionCondition.status);
        
        if (deletedCount === 0) {
          const statusKey = deletionCondition.status === 'DONE' ? 'no_completed_tasks' :
                           deletionCondition.status === 'IN_PROCESS' ? 'no_in_process_tasks' :
                           'no_to_do_tasks';
          return buildResponse(
            handlerInput,
            getTranslation(handlerInput, statusKey),
            getTranslation(handlerInput, 'what_else')
          );
        }

        const statusKey = deletionCondition.status === 'DONE' ? 'deleted_all_completed' :
                         deletionCondition.status === 'IN_PROCESS' ? 'deleted_all_in_process' :
                         'deleted_all_to_do';
        return buildResponse(
          handlerInput,
          getTranslation(handlerInput, statusKey, { count: deletedCount.toString() }),
          getTranslation(handlerInput, 'what_else')
        );
      } else if (deletionCondition.type === 'category' && deletionCondition.category) {
        // Delete tasks by category
        const deletedCount = await deleteTasksByCategory(notionClient, tasksDbId, deletionCondition.category);
        
        if (deletedCount === 0) {
          const categoryKey = deletionCondition.category === 'WORK' ? 'no_work_tasks' : 'no_personal_tasks';
          return buildResponse(
            handlerInput,
            getTranslation(handlerInput, categoryKey),
            getTranslation(handlerInput, 'what_else')
          );
        }

        const categoryKey = deletionCondition.category === 'WORK' ? 'deleted_all_work_tasks' : 'deleted_all_personal_tasks';
        return buildResponse(
          handlerInput,
          getTranslation(handlerInput, categoryKey, { count: deletedCount.toString() }),
          getTranslation(handlerInput, 'what_else')
        );
      } else if (deletionCondition.type === 'time' && deletionCondition.filter) {
        // Delete tasks by time filter
        const deletedCount = await deleteTasksByTimeFilter(notionClient, tasksDbId, deletionCondition.filter);
        
        if (deletedCount === 0) {
          return buildResponse(
            handlerInput,
            getTranslation(handlerInput, 'no_tasks_matching_time'),
            getTranslation(handlerInput, 'what_else')
          );
        }

        return buildResponse(
          handlerInput,
          getTranslation(handlerInput, 'deleted_tasks_by_time', { count: deletedCount.toString() }),
          getTranslation(handlerInput, 'what_else')
        );
      }
      
      // Default: Delete by task name (single task)
      // Remove "the task:" / "the tasks:" prefix before cleaning (common in test sentences)
      let cleanedSlot = userRequest;
      cleanedSlot = cleanedSlot.replace(/^the\s+task:\s*/i, '');
      cleanedSlot = cleanedSlot.replace(/^the\s+tasks:\s*/i, '');
      cleanedSlot = cleanedSlot.replace(/^task:\s*/i, '');
      cleanedSlot = cleanedSlot.replace(/^tasks:\s*/i, '');
      
      // Clean up the task name by removing command words
      const cleanedTaskName = cleanTaskName(cleanedSlot, locale);
      
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

