import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse, cleanTaskName, findMatchingTask } from '../utils/alexa';
import { findDatabaseByName, getAllTasks, updateTask } from '../utils/notion';
import { getTranslation, getLocale } from '../utils/i18n';
import * as chrono from 'chrono-node';

export class UpdateDueDateHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest 
      ? (handlerInput.requestEnvelope.request as any).intent?.name 
      : null;
    
    return isIntentRequest && intentName === 'UpdateDueDateIntent';
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
      const dueDateTime = slots.dueDateTime?.value;

      if (!taskName || taskName.trim().length === 0) {
        return buildResponse(
          handlerInput,
          getTranslation(handlerInput, 'update_task_prompt'),
          getTranslation(handlerInput, 'update_task_reprompt')
        );
      }

      if (!dueDateTime || dueDateTime.trim().length === 0) {
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

      // Parse date/time from dueDateTime slot using chrono-node
      const locale = getLocale(handlerInput);
      let parsedDueDateTime: string | null = null;
      if (dueDateTime) {
        // Use chrono-node as primary parser for better natural language support
        const chronoResult = chrono.parseDate(dueDateTime);
        if (chronoResult) {
          parsedDueDateTime = chronoResult.toISOString();
        } else {
          // Fallback to native Date if chrono fails
          const parsedDate = new Date(dueDateTime);
          if (!isNaN(parsedDate.getTime())) {
            parsedDueDateTime = parsedDate.toISOString();
          }
        }
      }

      if (!parsedDueDateTime) {
        return buildResponse(
          handlerInput,
          getTranslation(handlerInput, 'update_task_error'),
          getTranslation(handlerInput, 'what_would_you_like')
        );
      }

      // Clean task name
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

      // Update the task due date
      await updateTask(notionClient, matchingTask.id, { dueDateTime: parsedDueDateTime });

      // Build confirmation message
      const dueDate = new Date(parsedDueDateTime);
      const dateStr = dueDate.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
      const hours = dueDate.getHours();
      const minutes = dueDate.getMinutes();
      let confirmation: string;
      if (hours !== 0 || minutes !== 0) {
        const timeStr = dueDate.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', hour12: true });
        confirmation = getTranslation(handlerInput, 'task_updated', { 
          taskName: matchingTask.name, 
          updates: getTranslation(handlerInput, 'due_date_to_time', { date: dateStr, time: timeStr })
        });
      } else {
        confirmation = getTranslation(handlerInput, 'task_updated', { 
          taskName: matchingTask.name, 
          updates: getTranslation(handlerInput, 'due_date_to', { date: dateStr })
        });
      }

      return buildResponse(handlerInput, confirmation, getTranslation(handlerInput, 'what_else'));
    } catch (error: any) {
      console.error('[UpdateDueDateHandler] Error updating task due date:', error);
      console.error('[UpdateDueDateHandler] Error details:', {
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

