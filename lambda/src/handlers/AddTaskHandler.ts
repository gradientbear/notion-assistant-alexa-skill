import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse } from '../utils/alexa';
import { findDatabaseByName, addTask, parseTaskFromUtterance } from '../utils/notion';

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
          'Please link your Notion account in the Alexa app to use this feature.',
          'What would you like to do?'
        );
      }

      const request = handlerInput.requestEnvelope.request as any;
      const taskSlot = request.intent.slots?.task?.value;

      console.log('[AddTaskHandler] Handler invoked');
      console.log('[AddTaskHandler] Intent name:', request.intent.name);
      console.log('[AddTaskHandler] Task slot value:', taskSlot);
      console.log('[AddTaskHandler] Full request:', JSON.stringify({
        intent: request.intent.name,
        slots: request.intent.slots
      }));

      if (!taskSlot || taskSlot.trim().length === 0) {
        return buildResponse(
          handlerInput,
          'What task would you like to add?',
          'Tell me the task you want to add.'
        );
      }

      const tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
      if (!tasksDbId) {
        return buildResponse(
          handlerInput,
          'I couldn\'t find your Tasks database in Notion. Please make sure it exists and try again.',
          'What would you like to do?'
        );
      }

      // Parse task properties from utterance
      const parsed = parseTaskFromUtterance(taskSlot);
      console.log('[AddTaskHandler] Parsed task:', JSON.stringify(parsed));
      
      // Additional validation
      if (!parsed || !parsed.taskName) {
        console.error('[AddTaskHandler] Parsing returned invalid result:', parsed);
        return buildResponse(
          handlerInput,
          'I couldn\'t understand the task name. Please try again.',
          'What task would you like to add?'
        );
      }
      
      if (!parsed.taskName || parsed.taskName.trim().length === 0) {
        console.error('[AddTaskHandler] Empty task name after parsing. Original:', taskSlot);
        return buildResponse(
          handlerInput,
          'I couldn\'t understand the task name. Please try again.',
          'What task would you like to add?'
        );
      }

      // Add task with parsed properties
      console.log('[AddTaskHandler] Adding task to Notion:', {
        name: parsed.taskName,
        priority: parsed.priority || 'Medium',
        category: parsed.category || 'Personal',
        dueDate: parsed.dueDate,
        databaseId: tasksDbId
      });

      try {
        await addTask(
          notionClient,
          tasksDbId,
          parsed.taskName,
          parsed.priority || 'Medium',
          parsed.category || 'Personal',
          parsed.dueDate
        );
        console.log('[AddTaskHandler] Task added successfully to Notion');
      } catch (notionError: any) {
        console.error('[AddTaskHandler] Notion API error:', {
          message: notionError?.message,
          status: notionError?.status,
          code: notionError?.code,
          body: notionError?.body
        });
        throw notionError; // Re-throw to be caught by outer catch
      }

      // Build confirmation message
      let confirmation = `Added: ${parsed.taskName}`;
      
      if (parsed.priority === 'High') {
        confirmation = `Added high priority task: ${parsed.taskName}`;
      } else if (parsed.priority === 'Low') {
        confirmation = `Added low priority task: ${parsed.taskName}`;
      }

      if (parsed.dueDate) {
        const dueDate = new Date(parsed.dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDateOnly = new Date(dueDate);
        dueDateOnly.setHours(0, 0, 0, 0);

        if (dueDateOnly.getTime() === today.getTime()) {
          confirmation += ', due today';
        } else if (dueDateOnly.getTime() === today.getTime() + 86400000) {
          confirmation += ', due tomorrow';
        } else {
          confirmation += `, due ${dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        }
      }

      if (parsed.category && parsed.category !== 'Personal') {
        confirmation += ` to ${parsed.category.toLowerCase()}`;
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

