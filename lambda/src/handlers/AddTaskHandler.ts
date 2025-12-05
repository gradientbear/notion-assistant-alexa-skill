import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse } from '../utils/alexa';
import { findDatabaseByName, addTask } from '../utils/notion';
import { parseTaskFromUserRequest } from '../utils/parsing';

export class AddTaskHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest 
      ? (handlerInput.requestEnvelope.request as any).intent?.name 
      : null;
    
    const canHandle = isIntentRequest && intentName === 'AddTaskIntent';
    
    if (isIntentRequest) {
      console.log('[AddTaskHandler] canHandle check:', {
        isIntentRequest,
        intentName,
        canHandle
      });
    }
    
    return canHandle;
  }

  async handle(handlerInput: HandlerInput) {
    try {
      console.log('[AddTaskHandler] Handler started');
      const attributes = handlerInput.attributesManager.getSessionAttributes();
      const user = attributes.user;
      const notionClient = attributes.notionClient;

      console.log('[AddTaskHandler] Session check:', {
        hasUser: !!user,
        hasNotionClient: !!notionClient,
        userId: user?.id,
        hasNotionToken: !!user?.notion_token
      });

      if (!user || !notionClient) {
        console.warn('[AddTaskHandler] Missing user or Notion client');
        return buildResponse(
          handlerInput,
          'To add tasks, you need to connect your Notion account. ' +
          'Open the Alexa app, go to Skills, find Voice Planner, and click Link Account. ' +
          'Once connected, you can add tasks to your Notion workspace.',
          'What would you like to do?'
        );
      }

      const request = handlerInput.requestEnvelope.request as any;
      const slots = request.intent.slots || {};
      
      // Extract userRequest from AMAZON.SearchQuery slot
      const userRequest = slots.userRequest?.value;

      console.log('[AddTaskHandler] Handler invoked');
      console.log('[AddTaskHandler] Intent name:', request.intent.name);
      console.log('[AddTaskHandler] userRequest:', userRequest);

      // userRequest is required
      if (!userRequest || userRequest.trim().length === 0) {
        return buildResponse(
          handlerInput,
          'What task would you like to add?',
          'Tell me the task you want to add.'
        );
      }

      // Try to use stored database ID first, fallback to search
      let tasksDbId = user.tasks_db_id || null;
      
      if (!tasksDbId) {
        console.log('[AddTaskHandler] tasks_db_id not found in user record, searching by name...');
        tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
        
        // If found via search, update user record for future use
        if (tasksDbId) {
          console.log('[AddTaskHandler] Found Tasks database via search, consider updating user record');
        }
      } else {
        console.log('[AddTaskHandler] Using stored tasks_db_id:', tasksDbId);
      }
      
      if (!tasksDbId) {
        return buildResponse(
          handlerInput,
          'I couldn\'t find your Tasks database in Notion. ' +
          'Please make sure the database exists and is named exactly "Tasks". ' +
          'You can reconnect your Notion account in the app to set it up again.',
          'What would you like to do?'
        );
      }

      // Parse task from natural language using parsing utilities
      const parsed = parseTaskFromUserRequest(userRequest);
      
      console.log('[AddTaskHandler] Parsed task:', parsed);

      // Add task with parsed values
      console.log('[AddTaskHandler] Adding task to Notion:', {
        taskName: parsed.taskName,
        parsedName: parsed.parsedName,
        priority: parsed.priority,
        category: parsed.category,
        dueDateTime: parsed.dueDateTime,
        status: parsed.status,
        databaseId: tasksDbId
      });

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
        console.log('[AddTaskHandler] Task added successfully to Notion:', {
          pageId,
          taskName: parsed.taskName,
          databaseId: tasksDbId
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
      let confirmation = `Added: ${parsed.parsedName}`;
      
      if (parsed.priority === 'HIGH') {
        confirmation = `Added high priority task: ${parsed.parsedName}`;
      } else if (parsed.priority === 'LOW') {
        confirmation = `Added low priority task: ${parsed.parsedName}`;
      }

      if (parsed.dueDateTime) {
        const dueDateObj = new Date(parsed.dueDateTime);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDateOnly = new Date(dueDateObj);
        dueDateOnly.setHours(0, 0, 0, 0);

        if (dueDateOnly.getTime() === today.getTime()) {
          confirmation += ', due today';
        } else if (dueDateOnly.getTime() === today.getTime() + 86400000) {
          confirmation += ', due tomorrow';
        } else {
          confirmation += `, due ${dueDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        }
        
        // Add time if specified
        const hours = dueDateObj.getHours();
        const minutes = dueDateObj.getMinutes();
        if (hours !== 0 || minutes !== 0) {
          const timeStr = dueDateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
          confirmation += ` at ${timeStr}`;
        }
      }

      if (parsed.category === 'WORK') {
        confirmation += ' (work)';
      }

      confirmation += '.';

      return buildResponse(handlerInput, confirmation, 'What else would you like to do?');
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
        'I encountered an error adding your task. Please try again.',
        'What would you like to do?'
      );
    }
  }
}


