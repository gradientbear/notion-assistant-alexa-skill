import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse } from '../utils/alexa';
import { findDatabaseByName, addTask, parseTaskFromUtterance } from '../utils/notion';

export class AddTaskHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest 
      ? (handlerInput.requestEnvelope.request as any).intent?.name 
      : null;
    
    // Handle both AddTaskPhraseIntent and AddTaskStructuredIntent
    const canHandle = isIntentRequest && (
      intentName === 'AddTaskPhraseIntent' || 
      intentName === 'AddTaskStructuredIntent'
    );
    
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
      
      // Get slot values - handle both Phrase (taskName) and Structured (taskNameValue) intents
      const taskNameSlot = slots.taskName?.value || slots.taskNameValue?.value;
      const categorySlot = slots.category?.value;
      const prioritySlot = slots.priority?.value;
      const dueDateSlot = slots.dueDate?.value;
      const recurrenceSlot = slots.recurrence?.value;

      console.log('[AddTaskHandler] Handler invoked');
      console.log('[AddTaskHandler] Intent name:', request.intent.name);
      console.log('[AddTaskHandler] Slots:', {
        taskName: taskNameSlot,
        category: categorySlot,
        priority: prioritySlot,
        dueDate: dueDateSlot,
        recurrence: recurrenceSlot
      });

      // Task name is required
      if (!taskNameSlot || taskNameSlot.trim().length === 0) {
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

      // Normalize slot values
      const normalizePriority = (p: string | undefined): 'low' | 'normal' | 'high' | 'urgent' => {
        if (!p) return 'normal';
        const normalized = p.toLowerCase();
        if (normalized === 'medium') return 'normal';
        if (['low', 'normal', 'high', 'urgent'].includes(normalized)) {
          return normalized as any;
        }
        return 'normal';
      };

      const normalizeCategory = (c: string | undefined): 'work' | 'personal' | 'shopping' | 'fitness' | 'health' | 'notes' | 'general' => {
        if (!c) return 'personal';
        const normalized = c.toLowerCase();
        const valid = ['work', 'personal', 'shopping', 'fitness', 'health', 'notes', 'general'];
        if (valid.includes(normalized)) return normalized as any;
        return 'personal';
      };

      const normalizeRecurrence = (r: string | undefined): 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' => {
        if (!r) return 'none';
        const normalized = r.toLowerCase();
        const valid = ['none', 'daily', 'weekly', 'monthly', 'yearly'];
        if (valid.includes(normalized)) return normalized as any;
        return 'none';
      };

      // Parse due date from slot or utterance
      let dueDate: string | undefined = undefined;
      if (dueDateSlot) {
        // Alexa provides dates in ISO format or relative dates
        try {
          const date = new Date(dueDateSlot);
          if (!isNaN(date.getTime())) {
            dueDate = date.toISOString().split('T')[0];
          }
        } catch (e) {
          console.warn('[AddTaskHandler] Could not parse due date:', dueDateSlot);
        }
      }

      const taskName = taskNameSlot.trim();
      const priority = normalizePriority(prioritySlot);
      const category = normalizeCategory(categorySlot);
      const recurrence = normalizeRecurrence(recurrenceSlot);

      // Add task with slot values
      console.log('[AddTaskHandler] Adding task to Notion:', {
        name: taskName,
        priority,
        category,
        dueDate,
        recurrence,
        databaseId: tasksDbId
      });

      let pageId: string;
      try {
        pageId = await addTask(
          notionClient,
          tasksDbId,
          taskName,
          priority,
          category,
          dueDate,
          recurrence
        );
        console.log('[AddTaskHandler] Task added successfully to Notion:', {
          pageId,
          taskName,
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
      let confirmation = `Added: ${taskName}`;
      
      if (priority === 'urgent') {
        confirmation = `Added urgent task: ${taskName}`;
      } else if (priority === 'high') {
        confirmation = `Added high priority task: ${taskName}`;
      } else if (priority === 'low') {
        confirmation = `Added low priority task: ${taskName}`;
      }

      if (dueDate) {
        const dueDateObj = new Date(dueDate);
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
      }

      if (category && category !== 'personal') {
        confirmation += ` to ${category}`;
      }

      if (recurrence && recurrence !== 'none') {
        confirmation += `, recurring ${recurrence}`;
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


