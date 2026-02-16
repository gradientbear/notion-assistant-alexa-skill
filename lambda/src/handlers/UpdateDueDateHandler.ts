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
        // Clean the dueDateTime value - remove "scadenza" prefix if present (Italian)
        let cleanedDueDateTime = dueDateTime.trim();
        cleanedDueDateTime = cleanedDueDateTime.replace(/^scadenza\s+/i, '');
        
        const lowerDueDateTime = cleanedDueDateTime.toLowerCase();
        const now = new Date();
        
        // Handle Italian keywords explicitly (oggi, domani) — store date-only when no time
        if (lowerDueDateTime.includes('oggi') || lowerDueDateTime === 'today') {
          const today = new Date(now);
          today.setHours(0, 0, 0, 0);
          parsedDueDateTime = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;
        } else if (lowerDueDateTime.includes('domani') || lowerDueDateTime === 'tomorrow') {
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(0, 0, 0, 0);
          parsedDueDateTime = `${tomorrow.getUTCFullYear()}-${String(tomorrow.getUTCMonth() + 1).padStart(2, '0')}-${String(tomorrow.getUTCDate()).padStart(2, '0')}`;
        } else {
        // Use chrono-node as primary parser for better natural language support
          const chronoResult = chrono.parseDate(cleanedDueDateTime);
        if (chronoResult) {
          const d = new Date(chronoResult);
          parsedDueDateTime = (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0)
            ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
            : d.toISOString();
        } else {
          // Fallback to native Date if chrono fails
            const parsedDate = new Date(cleanedDueDateTime);
          if (!isNaN(parsedDate.getTime())) {
            parsedDueDateTime = (parsedDate.getUTCHours() === 0 && parsedDate.getUTCMinutes() === 0 && parsedDate.getUTCSeconds() === 0)
              ? `${parsedDate.getUTCFullYear()}-${String(parsedDate.getUTCMonth() + 1).padStart(2, '0')}-${String(parsedDate.getUTCDate()).padStart(2, '0')}`
              : parsedDate.toISOString();
            }
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

      // Build confirmation message (date-only when no time)
      const isDateOnly = !parsedDueDateTime.includes('T');
      const dueDate = new Date(parsedDueDateTime);
      const dateStr = isDateOnly
        ? dueDate.toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric' })
        : dueDate.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
      const hours = dueDate.getUTCHours();
      const minutes = dueDate.getUTCMinutes();
      let confirmation: string;
      if (!isDateOnly && (hours !== 0 || minutes !== 0)) {
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

