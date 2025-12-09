import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse } from '../utils/alexa';
import { findDatabaseByName, addTask } from '../utils/notion';
import { parseTaskFromUserRequest } from '../utils/parsing';
import { getTranslation, getLocale } from '../utils/i18n';

export class AddTaskHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest 
      ? (handlerInput.requestEnvelope.request as any).intent?.name 
      : null;
    
    const canHandle = isIntentRequest && intentName === 'AddTaskIntent';
    
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
      
      // Extract userRequest from AMAZON.SearchQuery slot
      const userRequest = slots.userRequest?.value;

      // userRequest is required
      if (!userRequest || userRequest.trim().length === 0) {
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

      // Parse task from natural language using parsing utilities
      const locale = getLocale(handlerInput);
      const parsed = parseTaskFromUserRequest(userRequest, locale);

      // Add task with parsed values
      let pageId: string;
      try {
        pageId = await addTask(
          notionClient,
          tasksDbId,
          parsed.taskName,
          parsed.parsedName,
          parsed.priority || 'NORMAL',
          parsed.category || 'PERSONAL',
          parsed.dueDateTime || null,
          parsed.status || 'TO DO'
        );
        });
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
      let confirmation = getTranslation(handlerInput, 'task_added', { taskName: parsed.parsedName });
      
      if (parsed.priority === 'HIGH') {
        confirmation = getTranslation(handlerInput, 'task_added_high', { taskName: parsed.parsedName });
      } else if (parsed.priority === 'LOW') {
        confirmation = getTranslation(handlerInput, 'task_added_low', { taskName: parsed.parsedName });
      }

      if (parsed.dueDateTime) {
        const dueDateObj = new Date(parsed.dueDateTime);
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

      if (parsed.category === 'WORK') {
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


