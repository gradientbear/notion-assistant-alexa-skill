import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse } from '../utils/alexa';
import { findDatabaseByName, addTask } from '../utils/notion';
import { getTranslation, getLocale } from '../utils/i18n';
import * as chrono from 'chrono-node';

export class AddTaskHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest 
      ? (handlerInput.requestEnvelope.request as any).intent?.name 
      : null;
    
    const canHandle = isIntentRequest && intentName === 'CreateTaskIntent';
    
    return canHandle;
  }

  async handle(handlerInput: HandlerInput) {
    try {
      const attributes = handlerInput.attributesManager.getSessionAttributes();
      const user = attributes.user;
      const notionClient = attributes.notionClient;

      if (!user || !notionClient) {
        return buildResponse(
          handlerInput,
          getTranslation(handlerInput, 'notion_required_add'),
          getTranslation(handlerInput, 'what_would_you_like')
        );
      }

      const request = handlerInput.requestEnvelope.request as any;
      const slots = request.intent.slots || {};
      
      // Extract values from specific slots
      const taskName = slots.taskName?.value;
      const priority = slots.priority?.value;
      const dueDateTime = slots.dueDateTime?.value;
      const category = slots.category?.value;
      const notes = slots.notes?.value;

      // Check required slots - dialog management will handle elicitation
      if (!taskName || taskName.trim().length === 0) {
        return buildResponse(
          handlerInput,
          getTranslation(handlerInput, 'add_task_prompt'),
          getTranslation(handlerInput, 'add_task_reprompt')
        );
      }

      if (!priority || priority.trim().length === 0) {
        return buildResponse(
          handlerInput,
          getTranslation(handlerInput, 'add_task_prompt'),
          getTranslation(handlerInput, 'add_task_reprompt')
        );
      }

      if (!dueDateTime || dueDateTime.trim().length === 0) {
        return buildResponse(
          handlerInput,
          getTranslation(handlerInput, 'add_task_prompt'),
          getTranslation(handlerInput, 'add_task_reprompt')
        );
      }

      if (!category || category.trim().length === 0) {
        return buildResponse(
          handlerInput,
          getTranslation(handlerInput, 'add_task_prompt'),
          getTranslation(handlerInput, 'add_task_reprompt')
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
          getTranslation(handlerInput, 'notion_db_not_found'),
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

      // Normalize priority and category values
      const normalizedPriority = priority.toUpperCase() === 'MEDIUM' ? 'NORMAL' : 
                                 (priority.toUpperCase() as 'LOW' | 'NORMAL' | 'HIGH');
      const normalizedCategory = category.toUpperCase() as 'PERSONAL' | 'WORK';
      
      // Clean task name
      const cleanedTaskName = taskName.trim();
      const parsedName = cleanedTaskName;

      // Add task with slot values
      let pageId: string;
      try {
        pageId = await addTask(
          notionClient,
          tasksDbId,
          cleanedTaskName,
          parsedName,
          normalizedPriority,
          normalizedCategory,
          parsedDueDateTime,
          'TO DO'
        );
      } catch (notionError: any) {
        console.error('[AddTaskHandler] Notion API error:', {
          message: notionError?.message,
          status: notionError?.status,
          code: notionError?.code,
          body: notionError?.body,
          stack: notionError?.stack
        });
        throw notionError; // Re-throw to be caught by outer catch
      }

      // Build confirmation message
      let confirmation = getTranslation(handlerInput, 'task_added', { taskName: parsedName });
      
      if (normalizedPriority === 'HIGH') {
        confirmation = getTranslation(handlerInput, 'task_added_high', { taskName: parsedName });
      } else if (normalizedPriority === 'LOW') {
        confirmation = getTranslation(handlerInput, 'task_added_low', { taskName: parsedName });
      }

      if (parsedDueDateTime) {
        const dueDateObj = new Date(parsedDueDateTime);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDateOnly = new Date(dueDateObj);
        dueDateOnly.setHours(0, 0, 0, 0);

        if (dueDateOnly.getTime() === today.getTime()) {
          confirmation += getTranslation(handlerInput, 'task_added_due_today');
        } else if (dueDateOnly.getTime() === today.getTime() + 86400000) {
          confirmation += getTranslation(handlerInput, 'task_added_due_tomorrow');
        } else {
          const dateStr = dueDateObj.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
          confirmation += getTranslation(handlerInput, 'task_added_due_date', { date: dateStr });
        }
        
        // Add time if specified
        const hours = dueDateObj.getHours();
        const minutes = dueDateObj.getMinutes();
        if (hours !== 0 || minutes !== 0) {
          const timeStr = dueDateObj.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', hour12: true });
          confirmation += getTranslation(handlerInput, 'task_added_due_time', { time: timeStr });
        }
      }

      if (normalizedCategory === 'WORK') {
        confirmation += getTranslation(handlerInput, 'task_added_work');
      }

      confirmation += '.';

      return buildResponse(handlerInput, confirmation, getTranslation(handlerInput, 'what_else'));
    } catch (error: any) {
      console.error('[AddTaskHandler] Error adding task:', error);
      console.error('[AddTaskHandler] Error details:', {
        message: error?.message,
        status: error?.status,
        code: error?.code,
        stack: error?.stack,
        name: error?.name,
        error: JSON.stringify(error)
      });
      return buildResponse(
        handlerInput,
        getTranslation(handlerInput, 'add_task_error'),
        getTranslation(handlerInput, 'what_would_you_like')
      );
    }
  }
}


