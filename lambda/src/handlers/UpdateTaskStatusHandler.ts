import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse, cleanTaskName, findMatchingTask } from '../utils/alexa';
import { findDatabaseByName, getAllTasks, updateTaskStatus } from '../utils/notion';
import { getTranslation, getLocale } from '../utils/i18n';
import { normalizeStatus } from '../utils/normalization';

export class UpdateTaskStatusHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest 
      ? (handlerInput.requestEnvelope.request as any).intent?.name 
      : null;
    
    return isIntentRequest && intentName === 'UpdateTaskStatusIntent';
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
      let status = slots.status?.value;

      if (!taskName || taskName.trim().length === 0) {
        return buildResponse(
          handlerInput,
          getTranslation(handlerInput, 'update_task_prompt'),
          getTranslation(handlerInput, 'update_task_reprompt')
        );
      }

      if (!status || status.trim().length === 0) {
        // Try to infer status from the taskName slot value
        // For utterances like "completa comprare il latte", the taskName might be "comprare il latte"
        // But for "segna come fatto comprare il latte", taskName might include "fatto"
        const taskNameLower = (taskName || '').toLowerCase();
        
        // Check for Italian completion patterns
        // Pattern 1: "segna come fatto X" → taskName might be "X" or "fatto X"
        if (taskNameLower.includes('come fatto') || 
            taskNameLower.includes('come completato') ||
            taskNameLower.startsWith('fatto ') ||
            taskNameLower.startsWith('completato ')) {
          status = 'DONE';
        }
        // Pattern 2: Check if taskName contains status keywords anywhere
        else if (taskNameLower.includes('fatto') || 
                 taskNameLower.includes('completato') ||
                 taskNameLower.includes('finito') ||
                 taskNameLower.includes('terminato')) {
          status = 'DONE';
        } else if (taskNameLower.includes('da fare') || taskNameLower.includes('todo')) {
          status = 'TO DO';
        } else {
          // For utterances like "completa {taskName}", Alexa typically doesn't include "completa" in taskName
          // We need to infer from the intent pattern itself
          // Since these samples exist: "completa {taskName}", "segna come fatto {taskName}"
          // If status is empty but taskName exists, and we matched these patterns, infer DONE
          // This is a reasonable default for completion verbs
          status = 'DONE'; // Default inference: if no status specified but taskName exists, assume completion
        }
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

      // Normalize status value
      const statusValue = normalizeStatus(status);

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

      // Update the task status
      await updateTaskStatus(notionClient, matchingTask.id, statusValue);

      // Build confirmation message
      const statusKey = statusValue === 'DONE' ? 'status_done' : 'status_to_do';
      const statusText = getTranslation(handlerInput, statusKey);
      const confirmation = getTranslation(handlerInput, 'task_updated', { 
        taskName: matchingTask.name, 
        updates: getTranslation(handlerInput, 'status_to', { status: statusText })
      });

      return buildResponse(handlerInput, confirmation, getTranslation(handlerInput, 'what_else'));
    } catch (error: any) {
      console.error('[UpdateTaskStatusHandler] Error updating task status:', error);
      console.error('[UpdateTaskStatusHandler] Error details:', {
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


