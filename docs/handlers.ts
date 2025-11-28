///// src/handlers/* ////////


//////////   AddTaskHandler.ts   //////////
import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse } from '../utils/alexa';
import { findDatabaseByName, addTask, parseTaskFromUtterance } from '../utils/notion';

export class AddTaskHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest 
      ? (handlerInput.requestEnvelope.request as any).intent?.name 
      : null;
    
    // Only handle AddTaskIntent - BrainDumpIntent is handled by BrainDumpHandler
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
          'Open the Alexa app, go to Skills, find Notion Data, and click Link Account. ' +
          'Once connected, you can add tasks to your Notion workspace.',
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

      let pageId: string;
      try {
        pageId = await addTask(
          notionClient,
          tasksDbId,
          parsed.taskName,
          parsed.priority || 'Medium',
          parsed.category || 'Personal',
          parsed.dueDate
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



//////////   BrainDumpHandler.ts   //////////
import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { IntentRequest } from 'ask-sdk-model';
import { buildResponse, buildSimpleResponse } from '../utils/alexa';
import { findDatabaseByName, addTask } from '../utils/notion';

export class BrainDumpHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest 
      ? (handlerInput.requestEnvelope.request as any).intent?.name 
      : null;
    
    const canHandle = isIntentRequest && intentName === 'BrainDumpIntent';
    
    if (isIntentRequest) {
      console.log('[BrainDumpHandler] canHandle check:', {
        isIntentRequest,
        intentName,
        canHandle
      });
    }
    
    return canHandle;
  }

  async handle(handlerInput: HandlerInput) {
    try {
      console.log('[BrainDumpHandler] Handler invoked');
      
      const attributes = handlerInput.attributesManager.getSessionAttributes();
      const user = attributes.user;
      const notionClient = attributes.notionClient;

    console.log('[BrainDumpHandler] User and client check:', {
      hasUser: !!user,
      hasNotionClient: !!notionClient,
      hasNotionToken: !!user?.notion_token
    });

    if (!user || !notionClient) {
      console.log('[BrainDumpHandler] Missing user or Notion client');
      return buildSimpleResponse(
        handlerInput,
        'Please link your Notion account in the Alexa app to use this feature.'
      );
    }

    const request = handlerInput.requestEnvelope.request as IntentRequest;
    const taskSlot = request.intent.slots?.task;

    console.log('[BrainDumpHandler] Task slot:', {
      hasSlot: !!taskSlot,
      slotValue: taskSlot?.value,
      slotConfidence: taskSlot?.confirmationStatus
    });

    // Check if we're in a multi-turn conversation
    const conversationState = attributes.brainDumpState || 'initial';
    
    console.log('[BrainDumpHandler] Conversation state:', conversationState);
    console.log('[BrainDumpHandler] Session attributes:', JSON.stringify(attributes));

    // If we're in collecting state, try to extract task from various sources
    // This handles cases where Alexa doesn't fill the task slot for follow-up utterances
    let userUtterance = request.intent.slots?.task?.value;
    const hasTaskSlot = !!userUtterance && userUtterance.trim().length > 0;
    
    // If in collecting state and no task slot, try to get the raw utterance
    if (conversationState === 'collecting' && !hasTaskSlot) {
      // Try to get the raw input from the request
      const rawInput = (request as any).input?.text || (request as any).rawInput;
      if (rawInput) {
        console.log('[BrainDumpHandler] No task slot, trying raw input:', rawInput);
        userUtterance = rawInput;
      }
      
      // Also check if the intent name itself contains useful info
      // For follow-up utterances, Alexa might send them as different intents
      if (!userUtterance && request.intent.name !== 'BrainDumpIntent') {
        console.log('[BrainDumpHandler] Intent changed during collection:', request.intent.name);
        // If we're collecting and get a different intent, treat it as a task
        // This handles cases where Alexa doesn't match follow-ups to BrainDumpIntent
      }
    }

    if (conversationState === 'initial') {
      // If user provided tasks in the same turn, process them immediately
      if (hasTaskSlot) {
        console.log('[BrainDumpHandler] Tasks provided in initial turn, processing immediately');
        attributes.brainDumpState = 'collecting';
        attributes.brainDumpTasks = [];
        // Fall through to processing logic
      } else {
        // Start the brain dump conversation
        attributes.brainDumpState = 'collecting';
        attributes.brainDumpTasks = [];
        handlerInput.attributesManager.setSessionAttributes(attributes);

        console.log('[BrainDumpHandler] Starting brain dump, waiting for tasks');
        return buildResponse(
          handlerInput,
          'I\'m ready to capture your thoughts. What tasks would you like to add?',
          'Tell me the tasks you want to add, or say done when finished.'
        );
      }
    }

    if (conversationState === 'collecting' || (conversationState === 'initial' && hasTaskSlot)) {
      // Ensure we're in collecting state
      if (conversationState === 'initial') {
        attributes.brainDumpState = 'collecting';
        attributes.brainDumpTasks = [];
      }

      // Use the task slot value if available, or try to extract from utterance
      let taskValue = userUtterance || request.intent.slots?.task?.value;
      
      // If no task value but we're collecting, try to get it from the request envelope
      if (!taskValue || taskValue.trim().length === 0) {
        // Try to extract from request envelope
        const requestEnvelope = handlerInput.requestEnvelope as any;
        const rawInput = requestEnvelope.request?.input?.text || 
                        requestEnvelope.request?.rawInput ||
                        requestEnvelope.request?.intent?.slots?.task?.value;
        
        if (rawInput) {
          console.log('[BrainDumpHandler] Extracted task from raw input:', rawInput);
          taskValue = rawInput;
        }
      }

      console.log('[BrainDumpHandler] User utterance/task value:', taskValue);
      console.log('[BrainDumpHandler] Full request envelope:', JSON.stringify(handlerInput.requestEnvelope, null, 2));

      if (!taskValue || taskValue.trim().length === 0) {
        console.log('[BrainDumpHandler] No task value found after all extraction attempts');
        // If we're in collecting state, ask them to repeat
        if (conversationState === 'collecting') {
          return buildResponse(
            handlerInput,
            'I didn\'t catch that task. Could you repeat it?',
            'Tell me the task again, or say done when finished.'
          );
        } else {
          return buildResponse(
            handlerInput,
            'I didn\'t catch that. What tasks would you like to add?',
            'Tell me the tasks, or say done when finished.'
          );
        }
      }

      // Clean up task name - remove "add" prefix if present
      // This handles cases where Alexa captures "add finish the report" instead of "finish the report"
      let cleanedTaskValue = taskValue.trim();
      const addPrefixPattern = /^add\s+/i;
      if (addPrefixPattern.test(cleanedTaskValue)) {
        cleanedTaskValue = cleanedTaskValue.replace(addPrefixPattern, '').trim();
        console.log('[BrainDumpHandler] Removed "add" prefix from task:', {
          original: taskValue,
          cleaned: cleanedTaskValue
        });
      }
      
      // Parse multiple tasks from a single utterance (split by "and", comma, etc.)
      const taskSeparators = /\s+(and|,|, and)\s+/i;
      const tasksFromUtterance = cleanedTaskValue.split(taskSeparators).filter(
        (part, index) => index % 2 === 0 && part.trim().length > 0
      ).map(task => task.trim());
      
      // If splitting didn't work, use the whole value as a single task
      if (tasksFromUtterance.length === 0) {
        tasksFromUtterance.push(cleanedTaskValue);
      }

      console.log('[BrainDumpHandler] Parsed tasks:', tasksFromUtterance);

      // Check if user said "done" or similar
      const donePhrases = ['done', 'finished', 'that\'s all', 'complete', 'nothing'];
      if (donePhrases.some(phrase => taskValue.toLowerCase().includes(phrase))) {
        // Save all collected tasks
        const tasks = attributes.brainDumpTasks || [];
        
        if (tasks.length === 0) {
          attributes.brainDumpState = 'initial';
          handlerInput.attributesManager.setSessionAttributes(attributes);
          return buildSimpleResponse(handlerInput, 'No tasks were added.');
        }

        // Find tasks database
        console.log('[BrainDumpHandler] Looking for Tasks database...');
        const tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
        console.log('[BrainDumpHandler] Tasks database ID:', tasksDbId);
        
        if (!tasksDbId) {
          attributes.brainDumpState = 'initial';
          handlerInput.attributesManager.setSessionAttributes(attributes);
          return buildSimpleResponse(
            handlerInput,
            'I couldn\'t find your Tasks database in Notion. ' +
            'Please make sure it exists and try again.'
          );
        }

        // Add all tasks
        try {
          console.log('[BrainDumpHandler] Adding tasks to Notion:', tasks);
          for (const taskName of tasks) {
            console.log('[BrainDumpHandler] Adding task:', taskName);
            await addTask(notionClient, tasksDbId, taskName);
            console.log('[BrainDumpHandler] Successfully added task:', taskName);
          }

          attributes.brainDumpState = 'initial';
          handlerInput.attributesManager.setSessionAttributes(attributes);

          console.log('[BrainDumpHandler] All tasks added successfully');
          return buildSimpleResponse(
            handlerInput,
            `Great! I've added ${tasks.length} task${tasks.length > 1 ? 's' : ''} to your Notion database.`
          );
        } catch (error: any) {
          console.error('[BrainDumpHandler] Error adding tasks:', error);
          console.error('[BrainDumpHandler] Error details:', {
            message: error?.message,
            status: error?.status,
            code: error?.code,
            stack: error?.stack
          });
          attributes.brainDumpState = 'initial';
          handlerInput.attributesManager.setSessionAttributes(attributes);
          return buildSimpleResponse(
            handlerInput,
            'I encountered an error adding your tasks. Please try again later.'
          );
        }
      }

      // If multiple tasks were provided, add them all and auto-save
      if (tasksFromUtterance.length > 1) {
        console.log('[BrainDumpHandler] Multiple tasks detected, auto-saving...');
        const existingTasks = attributes.brainDumpTasks || [];
        const allTasks = [...existingTasks, ...tasksFromUtterance];
        
        // Find tasks database
        console.log('[BrainDumpHandler] Looking for Tasks database...');
        const tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
        console.log('[BrainDumpHandler] Tasks database ID:', tasksDbId);
        
        if (!tasksDbId) {
          attributes.brainDumpState = 'initial';
          handlerInput.attributesManager.setSessionAttributes(attributes);
          return buildSimpleResponse(
            handlerInput,
            'I couldn\'t find your Tasks database in Notion. ' +
            'Please make sure it exists and try again.'
          );
        }

        // Add all tasks
        try {
          console.log('[BrainDumpHandler] Adding all tasks to Notion:', allTasks);
          for (const taskName of allTasks) {
            console.log('[BrainDumpHandler] Adding task:', taskName);
            await addTask(notionClient, tasksDbId, taskName);
            console.log('[BrainDumpHandler] Successfully added task:', taskName);
          }

          attributes.brainDumpState = 'initial';
          attributes.brainDumpTasks = [];
          handlerInput.attributesManager.setSessionAttributes(attributes);

          console.log('[BrainDumpHandler] All tasks added successfully');
          return buildSimpleResponse(
            handlerInput,
            `Great! I've added ${allTasks.length} task${allTasks.length > 1 ? 's' : ''} to your Notion database.`
          );
        } catch (error: any) {
          console.error('[BrainDumpHandler] Error adding tasks:', error);
          console.error('[BrainDumpHandler] Error details:', {
            message: error?.message,
            status: error?.status,
            code: error?.code
          });
          attributes.brainDumpState = 'initial';
          handlerInput.attributesManager.setSessionAttributes(attributes);
          return buildSimpleResponse(
            handlerInput,
            'I encountered an error adding your tasks. Please try again later.'
          );
        }
      }

      // Single task - add to collection and save immediately
      const tasks = attributes.brainDumpTasks || [];
      const taskToAdd = tasksFromUtterance[0] || taskValue;
      tasks.push(taskToAdd);
      
      // Find tasks database
      console.log('[BrainDumpHandler] Looking for Tasks database...');
      const tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
      console.log('[BrainDumpHandler] Tasks database ID:', tasksDbId);
      
      if (!tasksDbId) {
        attributes.brainDumpState = 'initial';
        handlerInput.attributesManager.setSessionAttributes(attributes);
        return buildResponse(
          handlerInput,
          'I couldn\'t find your Tasks database in Notion. ' +
          'Please make sure it exists and try again.',
          'What would you like to do?'
        );
      }

      // Save the task immediately to Notion
      try {
        console.log('[BrainDumpHandler] Adding task to Notion:', taskToAdd);
        await addTask(notionClient, tasksDbId, taskToAdd);
        console.log('[BrainDumpHandler] Successfully added task to Notion:', taskToAdd);
      } catch (error: any) {
        console.error('[BrainDumpHandler] Error adding task to Notion:', error);
        console.error('[BrainDumpHandler] Error details:', {
          message: error?.message,
          status: error?.status,
          code: error?.code
        });
        // Continue anyway - task is in collection, user can try again
      }
      
      attributes.brainDumpTasks = tasks;
      attributes.brainDumpState = 'collecting'; // Ensure state is set
      handlerInput.attributesManager.setSessionAttributes(attributes);

      console.log('[BrainDumpHandler] Task added to collection, total tasks:', tasks.length);
      return buildResponse(
        handlerInput,
        `Got it. Added "${taskToAdd}" to your Notion database. What else?`,
        'Tell me another task, or say done when finished.'
      );
    }

    return buildSimpleResponse(handlerInput, 'I\'m not sure what you want to do. Please try again.');
    } catch (error: any) {
      console.error('[BrainDumpHandler] Unexpected error:', error);
      console.error('[BrainDumpHandler] Error stack:', error?.stack);
      return buildSimpleResponse(
        handlerInput,
        'I encountered an error. Please try again.'
      );
    }
  }
}



//////////   ConnectionStatusHandler.ts   //////////
import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse } from '../utils/alexa';
import { createNotionClient } from '../utils/notion';

export class ConnectionStatusHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const intentName = handlerInput.requestEnvelope.request.type === 'IntentRequest'
      ? (handlerInput.requestEnvelope.request as any).intent?.name
      : null;

    return intentName === 'ConnectionStatusIntent' || 
           intentName === 'CheckConnectionIntent' ||
           intentName === 'AMAZON.HelpIntent' && this.isConnectionCheck(handlerInput);
  }

  private isConnectionCheck(handlerInput: HandlerInput): boolean {
    const request = handlerInput.requestEnvelope.request as any;
    const slots = request.intent?.slots || {};
    const query = slots.query?.value?.toLowerCase() || '';
    return query.includes('connection') || query.includes('status') || query.includes('connect');
  }

  async handle(handlerInput: HandlerInput) {
    try {
      const attributes = handlerInput.attributesManager.getSessionAttributes();
      const user = attributes.user;
      const notionClient = attributes.notionClient;

      console.log('[ConnectionStatusHandler] Checking connection status:', {
        hasUser: !!user,
        hasNotionClient: !!notionClient,
        hasNotionToken: !!user?.notion_token
      });

      if (!user || !user.notion_token) {
        return buildResponse(
          handlerInput,
          'Notion is not connected. To connect, open the Alexa app, go to Skills, ' +
          'find Notion Data, and click Link Account. Once connected, I can help you manage your tasks.',
          'What would you like to do?'
        );
      }

      // Test the connection by making a simple API call
      try {
        if (!notionClient) {
          // Create client if not in session
          const client = createNotionClient(user.notion_token);
          // Test with a simple search
          await client.search({ page_size: 1 });
        } else {
          await notionClient.search({ page_size: 1 });
        }

        return buildResponse(
          handlerInput,
          'Your Notion connection is working perfectly! I can access your Notion workspace and help you manage your tasks. ' +
          'What would you like to do?',
          'What would you like to do?'
        );
      } catch (error: any) {
        console.error('[ConnectionStatusHandler] Connection test failed:', error);
        
        if (error.code === 'unauthorized' || error.status === 401) {
          return buildResponse(
            handlerInput,
            'There seems to be an issue with your Notion connection. Your token may have expired. ' +
            'Please reconnect your Notion account in the Alexa app. Go to Skills, find Notion Data, and click Link Account again.',
            'What would you like to do?'
          );
        }

        return buildResponse(
          handlerInput,
          'I\'m having trouble connecting to your Notion workspace. Please try again in a moment, ' +
          'or reconnect your account in the Alexa app if the problem persists.',
          'What would you like to do?'
        );
      }
    } catch (error: any) {
      console.error('[ConnectionStatusHandler] Error:', error);
      return buildResponse(
        handlerInput,
        'Sorry, I encountered an error while checking your connection. Please try again.',
        'What would you like to do?'
      );
    }
  }
}



//////////   DeleteTaskHandler.ts   //////////
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

export class DeleteTaskHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest 
      ? (handlerInput.requestEnvelope.request as any).intent?.name 
      : null;
    const canHandle = isIntentRequest && intentName === 'DeleteTaskIntent';
    
    if (isIntentRequest) {
      console.log('[DeleteTaskHandler] canHandle check:', {
        isIntentRequest,
        intentName,
        canHandle
      });
    }
    
    return canHandle;
  }

  async handle(handlerInput: HandlerInput) {
    console.log('[DeleteTaskHandler] Handler invoked');
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;
    
    console.log('[DeleteTaskHandler] Session check:', {
      hasUser: !!user,
      hasNotionClient: !!notionClient,
      userId: user?.id
    });

    if (!user || !notionClient) {
      return buildResponse(
        handlerInput,
        'To delete tasks, you need to connect your Notion account. ' +
        'Open the Alexa app, go to Skills, find Notion Data, and click Link Account. ' +
        'Once connected, you can delete tasks from your Notion workspace.',
        'What would you like to do?'
      );
    }

    try {
      const request = handlerInput.requestEnvelope.request as any;
      const taskSlot = request.intent.slots?.task?.value;

      const tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
      if (!tasksDbId) {
        return buildResponse(
          handlerInput,
          'I couldn\'t find your Tasks database in Notion. Please make sure it exists and try again.',
          'What would you like to do?'
        );
      }

      // Check for batch operations
      const taskValue = taskSlot?.toLowerCase() || '';
      
      if (taskValue.includes('completed') || taskValue.includes('done')) {
        // Delete all completed tasks
        const deletedCount = await deleteCompletedTasks(notionClient, tasksDbId);
        
        if (deletedCount === 0) {
          return buildResponse(
            handlerInput,
            'You have no completed tasks to delete.',
            'What else would you like to do?'
          );
        }

        return buildResponse(
          handlerInput,
          `Deleted all completed tasks.`,
          'What else would you like to do?'
        );
      }

      // Single task deletion
      if (!taskSlot || taskSlot.trim().length === 0) {
        return buildResponse(
          handlerInput,
          'Which task would you like to delete?',
          'Tell me the task name.'
        );
      }

      // Clean up the task name by removing command words
      const cleanedTaskName = cleanTaskName(taskSlot);
      console.log('[DeleteTaskHandler] Original task slot:', taskSlot);
      console.log('[DeleteTaskHandler] Cleaned task name:', cleanedTaskName);

      console.log('[DeleteTaskHandler] Searching for task:', cleanedTaskName);
      
      const allTasks = await getAllTasks(notionClient, tasksDbId);
      console.log('[DeleteTaskHandler] Found tasks:', allTasks.length);
      console.log('[DeleteTaskHandler] Task names:', allTasks.map(t => t.name));

      // Hybrid matching: exact -> word token -> substring
      const matchingTask = findMatchingTask(cleanedTaskName, allTasks);

      console.log('[DeleteTaskHandler] Matching task:', matchingTask ? matchingTask.name : 'none found');

      if (!matchingTask) {
        return buildResponse(
          handlerInput,
          `I couldn't find "${cleanedTaskName}" in your tasks. Please try saying the full task name.`,
          'What else would you like to do?'
        );
      }

      await deleteTask(notionClient, matchingTask.id);

      return buildResponse(
        handlerInput,
        `Deleted: ${matchingTask.name} from your list.`,
        'What else would you like to do?'
      );
    } catch (error) {
      console.error('Error deleting task:', error);
      return buildResponse(
        handlerInput,
        'I encountered an error deleting your task. Please try again.',
        'What would you like to do?'
      );
    }
  }
}



//////////   EnergyTrackerHandler.ts   //////////
import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { IntentRequest } from 'ask-sdk-model';
import { buildResponse, buildSimpleResponse } from '../utils/alexa';
import { findDatabaseByName, logEnergy, mapEnergyLevel, getTimeOfDay } from '../utils/notion';

export class EnergyTrackerHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    return (
      handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      handlerInput.requestEnvelope.request.intent.name === 'EnergyTrackerIntent'
    );
  }

  async handle(handlerInput: HandlerInput) {
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;

    if (!user || !notionClient) {
      return buildSimpleResponse(
        handlerInput,
        'Please link your Notion account in the Alexa app to use this feature.'
      );
    }

    const request = handlerInput.requestEnvelope.request as IntentRequest;
    const energySlot = request.intent.slots?.energyLevel;

    let energyValue: number;

    if (energySlot && energySlot.value) {
      // Try to parse the energy level
      const parsed = parseInt(energySlot.value, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) {
        energyValue = parsed;
      } else {
        return buildResponse(
          handlerInput,
          'Please provide an energy level between 1 and 10.',
          'What is your energy level from 1 to 10?'
        );
      }
    } else {
      // Ask for energy level
      return buildResponse(
        handlerInput,
        'What is your energy level from 1 to 10?',
        'Please tell me your energy level from 1 to 10.'
      );
    }

    try {
      const energyLogsDbId = await findDatabaseByName(notionClient, 'Energy_Logs');
      if (!energyLogsDbId) {
        return buildSimpleResponse(
          handlerInput,
          'I couldn\'t find your Energy Logs database in Notion. ' +
          'Please make sure it exists and try again.'
        );
      }

      const energyLevel = mapEnergyLevel(energyValue);
      const timeOfDay = getTimeOfDay();

      await logEnergy(notionClient, energyLogsDbId, energyLevel, timeOfDay);

      return buildSimpleResponse(
        handlerInput,
        `Logged your energy level as ${energyLevel.toLowerCase()} for ${timeOfDay.toLowerCase()}.`
      );
    } catch (error) {
      console.error('Error logging energy:', error);
      return buildSimpleResponse(
        handlerInput,
        'I encountered an error logging your energy level. Please try again later.'
      );
    }
  }
}



//////////   EnergyTrackerHandler.ts   //////////
import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { IntentRequest } from 'ask-sdk-model';
import { buildResponse, buildSimpleResponse } from '../utils/alexa';
import { findDatabaseByName, logEnergy, mapEnergyLevel, getTimeOfDay } from '../utils/notion';

export class EnergyTrackerHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    return (
      handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      handlerInput.requestEnvelope.request.intent.name === 'EnergyTrackerIntent'
    );
  }

  async handle(handlerInput: HandlerInput) {
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;

    if (!user || !notionClient) {
      return buildSimpleResponse(
        handlerInput,
        'Please link your Notion account in the Alexa app to use this feature.'
      );
    }

    const request = handlerInput.requestEnvelope.request as IntentRequest;
    const energySlot = request.intent.slots?.energyLevel;

    let energyValue: number;

    if (energySlot && energySlot.value) {
      // Try to parse the energy level
      const parsed = parseInt(energySlot.value, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) {
        energyValue = parsed;
      } else {
        return buildResponse(
          handlerInput,
          'Please provide an energy level between 1 and 10.',
          'What is your energy level from 1 to 10?'
        );
      }
    } else {
      // Ask for energy level
      return buildResponse(
        handlerInput,
        'What is your energy level from 1 to 10?',
        'Please tell me your energy level from 1 to 10.'
      );
    }

    try {
      const energyLogsDbId = await findDatabaseByName(notionClient, 'Energy_Logs');
      if (!energyLogsDbId) {
        return buildSimpleResponse(
          handlerInput,
          'I couldn\'t find your Energy Logs database in Notion. ' +
          'Please make sure it exists and try again.'
        );
      }

      const energyLevel = mapEnergyLevel(energyValue);
      const timeOfDay = getTimeOfDay();

      await logEnergy(notionClient, energyLogsDbId, energyLevel, timeOfDay);

      return buildSimpleResponse(
        handlerInput,
        `Logged your energy level as ${energyLevel.toLowerCase()} for ${timeOfDay.toLowerCase()}.`
      );
    } catch (error) {
      console.error('Error logging energy:', error);
      return buildSimpleResponse(
        handlerInput,
        'I encountered an error logging your energy level. Please try again later.'
      );
    }
  }
}


//////////   ErrorHandler.ts   //////////
import { ErrorHandler as AskErrorHandler, HandlerInput } from 'ask-sdk-core';
import { buildSimpleResponse } from '../utils/alexa';

export class ErrorHandler implements AskErrorHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    return true;
  }

  async handle(handlerInput: HandlerInput) {
    const error = (handlerInput as any).error;
    const request = handlerInput.requestEnvelope.request;
    const requestType = request.type;
    
    console.error('[ErrorHandler] Error caught:', {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
      requestType,
      intentName: requestType === 'IntentRequest' ? (request as any).intent?.name : null,
      error: JSON.stringify(error)
    });

    // Handle specific error types
    if (error?.name === 'AskSdk.RequestEnvelopeError') {
      console.error('[ErrorHandler] Request envelope error');
      return buildSimpleResponse(
        handlerInput,
        'I encountered an error processing your request. Please try again.'
      );
    }

    if (error?.message === 'Invalid license' || error?.message?.includes('license')) {
      console.error('[ErrorHandler] License validation error');
      return buildSimpleResponse(
        handlerInput,
        'Your license key is invalid. Please contact support.'
      );
    }

    if (error?.message === 'User not found' || error?.message === 'Missing user ID') {
      console.error('[ErrorHandler] User authentication error');
      return buildSimpleResponse(
        handlerInput,
        'Please link your account in the Alexa app to use this skill.'
      );
    }

    // Check if this is an unhandled intent (no handler matched)
    if (requestType === 'IntentRequest' && !error) {
      const intentName = (request as any).intent?.name;
      console.error('[ErrorHandler] Unhandled intent:', intentName);
      return buildSimpleResponse(
        handlerInput,
        'I\'m not sure how to help with that. ' +
        'You can add tasks, list tasks, mark them complete, update them, or delete them. ' +
        'What would you like to do?'
      );
    }

    // Generic error response
    console.error('[ErrorHandler] Generic error, returning default message');
    return buildSimpleResponse(
      handlerInput,
      'Sorry, I encountered an error. Please try again later.'
    );
  }
}



//////////   FocusTimerHandler.ts   //////////
import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildSimpleResponse } from '../utils/alexa';
import { findDatabaseByName, logFocusSession } from '../utils/notion';

const FOCUS_DURATION_MINUTES = 25;

export class FocusTimerHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    return (
      handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      handlerInput.requestEnvelope.request.intent.name === 'FocusTimerIntent'
    );
  }

  async handle(handlerInput: HandlerInput) {
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;

    if (!user || !notionClient) {
      return buildSimpleResponse(
        handlerInput,
        'Please link your Notion account in the Alexa app to use this feature.'
      );
    }

    try {
      const focusLogsDbId = await findDatabaseByName(notionClient, 'Focus_Logs');
      if (!focusLogsDbId) {
        return buildSimpleResponse(
          handlerInput,
          'I couldn\'t find your Focus Logs database in Notion. ' +
          'Please make sure it exists and try again.'
        );
      }

      // Log the focus session start
      await logFocusSession(notionClient, focusLogsDbId, FOCUS_DURATION_MINUTES, 'Medium');

      // Start timer (Alexa will handle the timer, but we log it immediately)
      return buildSimpleResponse(
        handlerInput,
        `Starting your ${FOCUS_DURATION_MINUTES}-minute focus timer. ` +
        `I've logged this session to your Notion Focus Logs. ` +
        `Focus time starts now!`
      );
    } catch (error) {
      console.error('Error starting focus timer:', error);
      return buildSimpleResponse(
        handlerInput,
        'I encountered an error starting your focus timer. Please try again later.'
      );
    }
  }
}



//////////   LaunchRequestHandler.ts   //////////
import {
  RequestHandler,
  HandlerInput,
  RequestInterceptor,
} from 'ask-sdk-core';
import { Request } from 'ask-sdk-model';
import { getUserByAmazonId } from '../utils/database';
// import { validateLicense } from '../utils/database'; // Disabled for MVP
import { buildSimpleResponse, buildResponse, buildLinkAccountResponse } from '../utils/alexa';

export class LaunchRequestHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  }

  async handle(handlerInput: HandlerInput) {
    try {
      const userId = handlerInput.requestEnvelope.session?.user?.userId;
      
      console.log('[LaunchRequestHandler] userId:', userId);
      
      if (!userId) {
        console.log('[LaunchRequestHandler] No userId found');
        return buildSimpleResponse(
          handlerInput,
          'Welcome to Notion Data. Please enable the skill in your Alexa app to get started.'
        );
      }

      // Check if user exists - with timeout to prevent hanging
      let user = null;
      try {
        console.log('[LaunchRequestHandler] Starting user lookup...');
        // Add timeout to prevent hanging
        const userLookupPromise = getUserByAmazonId(userId);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database query timeout')), 3000)
        );
        
        user = await Promise.race([userLookupPromise, timeoutPromise]) as any;
        console.log('[LaunchRequestHandler] User lookup completed');
      } catch (dbError: any) {
        console.error('[LaunchRequestHandler] Database error when looking up user:', {
          message: dbError?.message,
          stack: dbError?.stack,
          name: dbError?.name
        });
        // Continue with user = null - will show setup message
        user = null;
      }
      
      console.log('[LaunchRequestHandler] User lookup result:', {
        found: !!user,
        hasNotionToken: !!user?.notion_token,
        notionTokenLength: user?.notion_token?.length || 0,
        notionTokenPreview: user?.notion_token ? user.notion_token.substring(0, 10) + '...' : 'null/empty',
        email: user?.email
      });
      
      if (!user) {
        console.log('[LaunchRequestHandler] User not found in database');
        return buildResponse(
          handlerInput,
          'Welcome to Notion Data! To get started, you need to link your account. ' +
          'Open the Alexa app on your phone, go to Skills, find Notion Data, and click Link Account. ' +
          'You\'ll need to sign in to your web account first. ' +
          'Would you like help setting up your account?',
          'Would you like help setting up your account?'
        );
      }

      // License validation disabled for MVP - focus on CRUD operations only

      // Check if Notion is connected
      if (!user.notion_token) {
        console.log('[LaunchRequestHandler] No notion_token found - returning link account response');
        return buildResponse(
          handlerInput,
          'To use Notion Data, you need to connect your Notion account. ' +
          'Open the Alexa app, go to Skills, find Notion Data, and click Link Account. ' +
          'Once connected, I can help you manage your tasks in Notion. ' +
          'Would you like help connecting your account?',
          'Would you like help connecting your account?'
        );
      }
      
      console.log('[LaunchRequestHandler] User has notion_token - proceeding with welcome message');

      // Store user in session
      const attributes = handlerInput.attributesManager.getSessionAttributes();
      attributes.user = user;
      handlerInput.attributesManager.setSessionAttributes(attributes);

      return buildResponse(
        handlerInput,
        'Welcome to Notion Data! I can help you manage your tasks. ' +
        'You can add tasks, list your tasks, mark them complete, update their status, or delete them. ' +
        'You can also check your connection status. What would you like to do?',
        'What would you like to do?'
      );
    } catch (error: any) {
      console.error('[LaunchRequestHandler] Unexpected error:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name
      });
      
      // ALWAYS return a response, even on error
      return buildResponse(
        handlerInput,
        'Welcome to Notion Data! I encountered an issue connecting to your account. ' +
        'Please try again in a moment, or open the Alexa app to check your account settings.',
        'What would you like to do?'
      );
    }
  }
}



//////////   MarkTaskCompleteHandler.ts   //////////
import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse, cleanTaskName, findMatchingTask } from '../utils/alexa';
import {
  findDatabaseByName,
  getAllTasks,
  getTasksByDateRange,
  markTaskComplete,
  markTasksCompleteBatch,
} from '../utils/notion';

export class MarkTaskCompleteHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest 
      ? (handlerInput.requestEnvelope.request as any).intent?.name 
      : null;
    const canHandle = isIntentRequest && intentName === 'MarkTaskCompleteIntent';
    
    if (isIntentRequest) {
      console.log('[MarkTaskCompleteHandler] canHandle check:', {
        isIntentRequest,
        intentName,
        canHandle
      });
    }
    
    return canHandle;
  }

  async handle(handlerInput: HandlerInput) {
    console.log('[MarkTaskCompleteHandler] ========== HANDLER INVOKED ==========');
    console.log('[MarkTaskCompleteHandler] Full request envelope:', JSON.stringify(handlerInput.requestEnvelope, null, 2));
    
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;
    
    console.log('[MarkTaskCompleteHandler] Session check:', {
      hasUser: !!user,
      hasNotionClient: !!notionClient,
      userId: user?.id
    });

    if (!user || !notionClient) {
      return buildResponse(
        handlerInput,
        'To mark tasks as complete, you need to connect your Notion account. ' +
        'Open the Alexa app, go to Skills, find Notion Data, and click Link Account. ' +
        'Once connected, you can manage your tasks.',
        'What would you like to do?'
      );
    }

    try {
      const request = handlerInput.requestEnvelope.request as any;
      const taskSlot = request.intent.slots?.task?.value;
      
      console.log('[MarkTaskCompleteHandler] Full request envelope:', JSON.stringify(handlerInput.requestEnvelope, null, 2));

      const tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
      if (!tasksDbId) {
        return buildResponse(
          handlerInput,
          'I couldn\'t find your Tasks database in Notion. Please make sure it exists and try again.',
          'What would you like to do?'
        );
      }

      // Check for batch operations
      const taskValue = taskSlot?.toLowerCase() || '';
      
      if (taskValue.includes('all') && (taskValue.includes('today') || taskValue.includes("today's"))) {
        // Mark all today's tasks as complete
        const today = new Date().toISOString().split('T')[0];
        const tasks = await getTasksByDateRange(notionClient, tasksDbId, today);
        
        if (tasks.length === 0) {
          return buildResponse(
            handlerInput,
            'You have no tasks due today.',
            'What else would you like to do?'
          );
        }

        const taskIds = tasks.map(t => t.id);
        await markTasksCompleteBatch(notionClient, tasksDbId, taskIds);

        return buildResponse(
          handlerInput,
          `Marked ${tasks.length} task${tasks.length > 1 ? 's' : ''} as complete.`,
          'What else would you like to do?'
        );
      }

      // Single task completion
      if (!taskSlot || taskSlot.trim().length === 0) {
        return buildResponse(
          handlerInput,
          'Which task would you like to mark as complete?',
          'Tell me the task name.'
        );
      }

      // Clean up the task name by removing command words
      const cleanedTaskName = cleanTaskName(taskSlot);
      
      console.log('[MarkTaskCompleteHandler] Original task slot:', taskSlot);
      console.log('[MarkTaskCompleteHandler] Cleaned task name:', cleanedTaskName);

      console.log('[MarkTaskCompleteHandler] Searching for task:', cleanedTaskName);
      
      const allTasks = await getAllTasks(notionClient, tasksDbId);
      console.log('[MarkTaskCompleteHandler] Found tasks:', allTasks.length);
      console.log('[MarkTaskCompleteHandler] Task names:', allTasks.map(t => t.name));
      console.log('[MarkTaskCompleteHandler] Task statuses:', allTasks.map(t => ({ name: t.name, status: t.status })));

      // Hybrid matching: exact -> word token -> substring
      const matchingTask = findMatchingTask(cleanedTaskName, allTasks);

      console.log('[MarkTaskCompleteHandler] Matching task:', matchingTask ? { name: matchingTask.name, id: matchingTask.id, status: matchingTask.status } : 'none found');

      if (!matchingTask) {
        console.log('[MarkTaskCompleteHandler] No matching task found');
        return buildResponse(
          handlerInput,
          `I couldn't find "${cleanedTaskName}" in your tasks. Please try saying the full task name.`,
          'What else would you like to do?'
        );
      }

      console.log('[MarkTaskCompleteHandler] Calling markTaskComplete for task:', {
        taskId: matchingTask.id,
        taskName: matchingTask.name,
        currentStatus: matchingTask.status
      });
      
      try {
        await markTaskComplete(notionClient, matchingTask.id);
        
        // Verify the update succeeded by retrieving the page
        try {
          const updatedPage = await notionClient.pages.retrieve({ page_id: matchingTask.id });
          const updatedProps = (updatedPage as any).properties;
          const actualStatus = updatedProps.Status?.select?.name || 'Unknown';
          console.log('[MarkTaskCompleteHandler] Status update verified:', {
            expectedStatus: 'Done',
            actualStatus: actualStatus,
            match: actualStatus === 'Done'
          });
          
          if (actualStatus !== 'Done') {
            console.error('[MarkTaskCompleteHandler] Status mismatch! Expected: Done, Got:', actualStatus);
            return buildResponse(
              handlerInput,
              `I tried to mark ${matchingTask.name} as complete, but there was an issue. The task status is currently ${actualStatus}.`,
              'What else would you like to do?'
            );
          }
        } catch (verifyError: any) {
          console.warn('[MarkTaskCompleteHandler] Could not verify status update:', verifyError.message);
          // Continue anyway - the update might have succeeded
        }
        
        console.log('[MarkTaskCompleteHandler] Task marked as complete successfully');
        return buildResponse(
          handlerInput,
          `Marked: ${matchingTask.name} as complete.`,
          'What else would you like to do?'
        );
      } catch (markError: any) {
        console.error('[MarkTaskCompleteHandler] Error in markTaskComplete call:', {
          message: markError?.message,
          status: markError?.status,
          code: markError?.code,
          stack: markError?.stack
        });
        throw markError; // Re-throw to be caught by outer catch
      }
    } catch (error: any) {
      console.error('[MarkTaskCompleteHandler] Error marking task complete:', error);
      console.error('[MarkTaskCompleteHandler] Error details:', {
        message: error?.message,
        status: error?.status,
        code: error?.code,
        stack: error?.stack
      });
      return buildResponse(
        handlerInput,
        'I encountered an error marking your task as complete. Please try again.',
        'What would you like to do?'
      );
    }
  }
}



//////////   PriorityListHandler.ts   //////////
import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildSimpleResponse } from '../utils/alexa';
import { findDatabaseByName, getTopPriorityTasks } from '../utils/notion';

export class PriorityListHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    return (
      handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      handlerInput.requestEnvelope.request.intent.name === 'PriorityListIntent'
    );
  }

  async handle(handlerInput: HandlerInput) {
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;

    if (!user || !notionClient) {
      return buildSimpleResponse(
        handlerInput,
        'Please link your Notion account in the Alexa app to use this feature.'
      );
    }

    try {
      const tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
      if (!tasksDbId) {
        return buildSimpleResponse(
          handlerInput,
          'I couldn\'t find your Tasks database in Notion. ' +
          'Please make sure it exists and try again.'
        );
      }

      const tasks = await getTopPriorityTasks(notionClient, tasksDbId, 3);

      if (tasks.length === 0) {
        return buildSimpleResponse(
          handlerInput,
          'You have no priority tasks right now. Great job staying on top of things!'
        );
      }

      let speechText = 'Here are your top 3 priority tasks: ';
      tasks.forEach((task, index) => {
        speechText += `${index + 1}. ${task.name}`;
        if (task.priority === 'High') {
          speechText += ', high priority';
        }
        if (task.dueDate) {
          const dueDate = new Date(task.dueDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const dueDateOnly = new Date(dueDate);
          dueDateOnly.setHours(0, 0, 0, 0);
          
          if (dueDateOnly.getTime() === today.getTime()) {
            speechText += ', due today';
          } else if (dueDateOnly.getTime() < today.getTime()) {
            speechText += ', overdue';
          } else {
            speechText += `, due ${dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
          }
        }
        speechText += '. ';
      });

      return buildSimpleResponse(handlerInput, speechText);
    } catch (error) {
      console.error('Error getting priority tasks:', error);
      return buildSimpleResponse(
        handlerInput,
        'I encountered an error retrieving your priority tasks. Please try again later.'
      );
    }
  }
}



//////////   ScheduleHandler.ts   //////////
import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildSimpleResponse } from '../utils/alexa';
import { findDatabaseByName, getTodayTasks } from '../utils/notion';

export class ScheduleHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    return (
      handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      handlerInput.requestEnvelope.request.intent.name === 'ScheduleIntent'
    );
  }

  async handle(handlerInput: HandlerInput) {
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;

    if (!user || !notionClient) {
      return buildSimpleResponse(
        handlerInput,
        'Please link your Notion account in the Alexa app to use this feature.'
      );
    }

    try {
      const tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
      if (!tasksDbId) {
        return buildSimpleResponse(
          handlerInput,
          'I couldn\'t find your Tasks database in Notion. ' +
          'Please make sure it exists and try again.'
        );
      }

      const tasks = await getTodayTasks(notionClient, tasksDbId);

      if (tasks.length === 0) {
        return buildSimpleResponse(
          handlerInput,
          'You have no tasks scheduled for today. Enjoy your free day!'
        );
      }

      let speechText = `You have ${tasks.length} task${tasks.length > 1 ? 's' : ''} for today: `;
      tasks.forEach((task, index) => {
        speechText += `${index + 1}. ${task.name}`;
        if (task.priority === 'High') {
          speechText += ', high priority';
        }
        if (task.category) {
          speechText += `, ${task.category}`;
        }
        speechText += '. ';
      });

      return buildSimpleResponse(handlerInput, speechText);
    } catch (error) {
      console.error('Error getting schedule:', error);
      return buildSimpleResponse(
        handlerInput,
        'I encountered an error retrieving your schedule. Please try again later.'
      );
    }
  }
}




//////////   SessionEndedHandler.ts   //////////
import { RequestHandler, HandlerInput } from 'ask-sdk-core';

export class SessionEndedHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  }

  async handle(handlerInput: HandlerInput) {
    console.log('Session ended:', handlerInput.requestEnvelope.request);
    return handlerInput.responseBuilder.getResponse();
  }
}



//////////   ShoppingListHandler.ts   //////////
import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { IntentRequest } from 'ask-sdk-model';
import { buildResponse, buildSimpleResponse } from '../utils/alexa';
import { findDatabaseByName, getShoppingListTasks, addTask, markTaskComplete } from '../utils/notion';

export class ShoppingListHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    return (
      handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      (handlerInput.requestEnvelope.request.intent.name === 'AddShoppingIntent' ||
       handlerInput.requestEnvelope.request.intent.name === 'ReadShoppingIntent' ||
       handlerInput.requestEnvelope.request.intent.name === 'MarkShoppingCompleteIntent')
    );
  }

  async handle(handlerInput: HandlerInput) {
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;

    if (!user || !notionClient) {
      return buildSimpleResponse(
        handlerInput,
        'Please link your Notion account in the Alexa app to use this feature.'
      );
    }

    const request = handlerInput.requestEnvelope.request as IntentRequest;
    const intentName = request.intent.name;

    try {
      const tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
      if (!tasksDbId) {
        return buildSimpleResponse(
          handlerInput,
          'I couldn\'t find your Tasks database in Notion. ' +
          'Please make sure it exists and try again.'
        );
      }

      if (intentName === 'AddShoppingIntent') {
        const itemsSlot = request.intent.slots?.items;
        
        if (!itemsSlot || !itemsSlot.value) {
          return buildResponse(
            handlerInput,
            'What items would you like to add to your shopping list?',
            'Tell me the items you want to add.'
          );
        }

        const itemsText = itemsSlot.value;
        // Split by comma or "and"
        const items = itemsText
          .split(/,|and/)
          .map(item => item.trim())
          .filter(item => item.length > 0);

        if (items.length === 0) {
          return buildResponse(
            handlerInput,
            'I didn\'t catch the items. What would you like to add?',
            'Tell me the items for your shopping list.'
          );
        }

        // Add each item as a task with Shopping category
        for (const item of items) {
          await addTask(notionClient, tasksDbId, item, 'Medium', 'Shopping');
        }

        const itemsList = items.length === 1 
          ? items[0] 
          : items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];

        return buildSimpleResponse(
          handlerInput,
          `Added to shopping list: ${itemsList}.`
        );
      }

      if (intentName === 'ReadShoppingIntent') {
        const tasks = await getShoppingListTasks(notionClient, tasksDbId);

        if (tasks.length === 0) {
          return buildSimpleResponse(handlerInput, 'Your shopping list is empty.');
        }

        let speechText = `Your shopping list has ${tasks.length} item${tasks.length > 1 ? 's' : ''}: `;
        tasks.forEach((task, index) => {
          speechText += task.name;
          if (index < tasks.length - 1) {
            speechText += ', ';
          }
        });
        speechText += '.';

        return buildSimpleResponse(handlerInput, speechText);
      }

      if (intentName === 'MarkShoppingCompleteIntent') {
        const itemSlot = request.intent.slots?.item;
        
        if (!itemSlot || !itemSlot.value) {
          return buildResponse(
            handlerInput,
            'Which item would you like to mark as complete?',
            'Tell me the item name.'
          );
        }

        const itemName = itemSlot.value.toLowerCase();
        const tasks = await getShoppingListTasks(notionClient, tasksDbId);
        
        const matchingTask = tasks.find(
          task => task.name.toLowerCase().includes(itemName) || 
                  itemName.includes(task.name.toLowerCase())
        );

        if (!matchingTask) {
          return buildSimpleResponse(
            handlerInput,
            `I couldn't find "${itemSlot.value}" on your shopping list.`
          );
        }

        await markTaskComplete(notionClient, matchingTask.id);

        return buildSimpleResponse(
          handlerInput,
          `Marked ${matchingTask.name} as complete.`
        );
      }

      return buildSimpleResponse(handlerInput, 'I\'m not sure what you want to do with your shopping list.');
    } catch (error) {
      console.error('Error handling shopping list:', error);
      return buildSimpleResponse(
        handlerInput,
        'I encountered an error with your shopping list. Please try again later.'
      );
    }
  }
}



//////////   TaskListHandler.ts   //////////
import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse } from '../utils/alexa';
import {
  findDatabaseByName,
  getAllTasks,
  getTasksByPriority,
  getTasksByStatus,
  getTasksByCategory,
  getPendingTasks,
  getOverdueTasks,
  getTasksDueTomorrow,
  getTasksDueThisWeek,
  getCompletedTasks,
  getTodayTasks,
} from '../utils/notion';

export class TaskListHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest
      ? (handlerInput.requestEnvelope.request as any).intent?.name
      : null;

    const supportedIntents = [
      'TaskListIntent',
      'HighPriorityTasksIntent',
      'ToDoListIntent',
      'PendingTasksIntent',
      'WorkTasksIntent',
      'PersonalRemindersIntent',
      'WorkoutPlanIntent',
      'OverdueTasksIntent',
      'TasksDueTomorrowIntent',
      'TasksDueThisWeekIntent',
      'InProgressTasksIntent',
      'CompletedTasksIntent',
    ];
    
    const canHandle = intentName !== null && supportedIntents.includes(intentName);
    
    if (isIntentRequest) {
      console.log('[TaskListHandler] canHandle check:', {
        isIntentRequest,
        intentName,
        canHandle,
        isSupported: intentName ? supportedIntents.includes(intentName) : false
      });
    }
    
    return canHandle;
  }

  async handle(handlerInput: HandlerInput) {
    console.log('[TaskListHandler] Handler invoked');
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;
    
    console.log('[TaskListHandler] Session check:', {
      hasUser: !!user,
      hasNotionClient: !!notionClient,
      userId: user?.id
    });

    if (!user || !notionClient) {
      return buildResponse(
        handlerInput,
        'To view your tasks, you need to connect your Notion account. ' +
        'Open the Alexa app, go to Skills, find Notion Data, and click Link Account. ' +
        'Once connected, I can show you your tasks from Notion.',
        'What would you like to do?'
      );
    }

    const intentName = (handlerInput.requestEnvelope.request as any).intent.name;

    try {
      const tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
      if (!tasksDbId) {
        return buildResponse(
          handlerInput,
          'I couldn\'t find your Tasks database in Notion. Please make sure it exists and try again.',
          'What would you like to do?'
        );
      }

      let tasks: any[] = [];
      let speechText = '';

      switch (intentName) {
        case 'TaskListIntent':
          tasks = await getAllTasks(notionClient, tasksDbId);
          if (tasks.length === 0) {
            speechText = 'You have no tasks right now.';
          } else {
            speechText = `You have ${tasks.length} task${tasks.length > 1 ? 's' : ''}: `;
            speechText += tasks.slice(0, 10).map(t => t.name).join(', ');
            if (tasks.length > 10) {
              speechText += `, and ${tasks.length - 10} more.`;
            }
          }
          break;

        case 'HighPriorityTasksIntent':
          tasks = await getTasksByPriority(notionClient, tasksDbId, 'High');
          if (tasks.length === 0) {
            speechText = 'You have no high priority tasks right now.';
          } else {
            speechText = `Your high priority tasks are: ${tasks.map(t => t.name).join(', ')}.`;
          }
          break;

        case 'ToDoListIntent':
          tasks = await getTasksByStatus(notionClient, tasksDbId, 'To Do');
          if (tasks.length === 0) {
            speechText = 'Your to-do list is empty.';
          } else {
            speechText = `Your to-do items are: ${tasks.map(t => t.name).join(', ')}.`;
          }
          break;

        case 'PendingTasksIntent':
          tasks = await getPendingTasks(notionClient, tasksDbId);
          if (tasks.length === 0) {
            speechText = 'You have no pending tasks.';
          } else {
            speechText = `You have ${tasks.length} pending task${tasks.length > 1 ? 's' : ''}: ${tasks.map(t => t.name).join(', ')}.`;
          }
          break;

        case 'WorkTasksIntent':
          tasks = await getTasksByCategory(notionClient, tasksDbId, 'Work');
          if (tasks.length === 0) {
            speechText = 'You have no work tasks.';
          } else {
            speechText = `Your work tasks are: ${tasks.map(t => t.name).join(', ')}.`;
          }
          break;

        case 'PersonalRemindersIntent':
          tasks = await getTasksByCategory(notionClient, tasksDbId, 'Personal');
          if (tasks.length === 0) {
            speechText = 'You have no personal reminders.';
          } else {
            speechText = `Your reminders: ${tasks.map(t => t.name).join(', ')}.`;
          }
          break;

        case 'WorkoutPlanIntent':
          tasks = await getTasksByCategory(notionClient, tasksDbId, 'Fitness');
          if (tasks.length === 0) {
            speechText = 'You have no workout plan items.';
          } else {
            speechText = `Your workout plan: ${tasks.map(t => t.name).join(', ')}.`;
          }
          break;

        case 'OverdueTasksIntent':
          tasks = await getOverdueTasks(notionClient, tasksDbId);
          if (tasks.length === 0) {
            speechText = 'You have no overdue tasks. Great job!';
          } else {
            speechText = `You have ${tasks.length} overdue task${tasks.length > 1 ? 's' : ''}: ${tasks.map(t => t.name).join(', ')}.`;
          }
          break;

        case 'TasksDueTomorrowIntent':
          tasks = await getTasksDueTomorrow(notionClient, tasksDbId);
          if (tasks.length === 0) {
            speechText = 'You have nothing due tomorrow.';
          } else {
            speechText = `Tomorrow you have: ${tasks.map(t => t.name).join(', ')}.`;
          }
          break;

        case 'TasksDueThisWeekIntent':
          tasks = await getTasksDueThisWeek(notionClient, tasksDbId);
          if (tasks.length === 0) {
            speechText = 'You have nothing due this week.';
          } else {
            speechText = `This week: ${tasks.length} task${tasks.length > 1 ? 's' : ''} due. ${tasks.map(t => t.name).join(', ')}.`;
          }
          break;

        case 'InProgressTasksIntent':
          tasks = await getTasksByStatus(notionClient, tasksDbId, 'In Progress');
          if (tasks.length === 0) {
            speechText = 'You\'re not currently working on any tasks.';
          } else {
            speechText = `You're currently working on: ${tasks.map(t => t.name).join(', ')}.`;
          }
          break;

        case 'CompletedTasksIntent':
          tasks = await getCompletedTasks(notionClient, tasksDbId);
          if (tasks.length === 0) {
            speechText = 'You haven\'t completed any tasks yet.';
          } else {
            const recentTasks = tasks.slice(0, 10);
            speechText = `You've completed ${tasks.length} task${tasks.length > 1 ? 's' : ''}. ${recentTasks.map(t => t.name).join(', ')}.`;
          }
          break;

        default:
          speechText = 'I didn\'t understand that request.';
      }

      return buildResponse(handlerInput, speechText, 'What else would you like to do?');
    } catch (error) {
      console.error('Error getting tasks:', error);
      return buildResponse(
        handlerInput,
        'I encountered an error retrieving your tasks. Please try again later.',
        'What would you like to do?'
      );
    }
  }
}



//////////   UnhandledIntentHandler.ts   //////////
import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse, findMatchingTask } from '../utils/alexa';
import { findDatabaseByName, addTask, getAllTasks, markTaskComplete } from '../utils/notion';

/**
 * Handles intents that don't match any specific handler.
 * Provides helpful guidance to users about available commands.
 * Also handles follow-up tasks during brain dump sessions.
 */
export class UnhandledIntentHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    // This handler should be added last, so it only handles intents that no other handler can handle
    // The SDK will call this if no other handler's canHandle returns true
    return handlerInput.requestEnvelope.request.type === 'IntentRequest';
  }

  async handle(handlerInput: HandlerInput) {
    console.log('[UnhandledIntentHandler] ========== HANDLER INVOKED ==========');
    const request = handlerInput.requestEnvelope.request as any;
    const intentName = request.intent?.name;
    
    console.log('[UnhandledIntentHandler] Intent name:', intentName);
    console.log('[UnhandledIntentHandler] Full request envelope:', JSON.stringify(handlerInput.requestEnvelope, null, 2));
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const conversationState = attributes.brainDumpState || 'initial';
    
    console.log('[UnhandledIntentHandler] Unhandled intent:', intentName);
    console.log('[UnhandledIntentHandler] Conversation state:', conversationState);
    
    // Check if we're in a brain dump collecting state
    // If so, treat any utterance as a potential task
    if (conversationState === 'collecting') {
      const user = attributes.user;
      const notionClient = attributes.notionClient;
      
      if (user && notionClient) {
        // Try to extract task from the intent slots or utterance
        let taskValue = request.intent?.slots?.task?.value;
        
        // If no task slot, try to get it from other sources
        if (!taskValue || taskValue.trim().length === 0) {
          // Check for raw input or other slot values
          const allSlots = request.intent?.slots || {};
          for (const slotName in allSlots) {
            const slot = allSlots[slotName];
            if (slot?.value && slot.value.trim().length > 0) {
              taskValue = slot.value;
              break;
            }
          }
        }
        
        // If still no task value, check if "done" was said
        const donePhrases = ['done', 'finished', 'that\'s all', 'complete', 'nothing'];
        if (taskValue && donePhrases.some(phrase => taskValue.toLowerCase().includes(phrase))) {
          // User said done - save all collected tasks
          const tasks = attributes.brainDumpTasks || [];
          if (tasks.length > 0) {
            try {
              const tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
              if (tasksDbId) {
                // Tasks should already be saved (we save immediately now)
                // Just confirm
                attributes.brainDumpState = 'initial';
                attributes.brainDumpTasks = [];
                handlerInput.attributesManager.setSessionAttributes(attributes);
                
                return buildResponse(
                  handlerInput,
                  `Great! I've saved all your tasks. You had ${tasks.length} task${tasks.length > 1 ? 's' : ''} in total.`,
                  'What else would you like to do?'
                );
              }
            } catch (error: any) {
              console.error('[UnhandledIntentHandler] Error processing done:', error);
            }
          }
          
          attributes.brainDumpState = 'initial';
          attributes.brainDumpTasks = [];
          handlerInput.attributesManager.setSessionAttributes(attributes);
          return buildResponse(
            handlerInput,
            'Brain dump session ended.',
            'What would you like to do?'
          );
        }
        
        // If we have a task value, treat it as a task and add it
        if (taskValue && taskValue.trim().length > 0) {
          console.log('[UnhandledIntentHandler] Treating unhandled intent as task during brain dump:', taskValue);
          
          try {
            const tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
            if (tasksDbId) {
              // Add task to collection
              const tasks = attributes.brainDumpTasks || [];
              tasks.push(taskValue.trim());
              attributes.brainDumpTasks = tasks;
              
              // Save immediately to Notion
              await addTask(notionClient, tasksDbId, taskValue.trim());
              console.log('[UnhandledIntentHandler] Task added to Notion:', taskValue);
              
              handlerInput.attributesManager.setSessionAttributes(attributes);
              
              return buildResponse(
                handlerInput,
                `Got it. Added "${taskValue}" to your Notion database. What else?`,
                'Tell me another task, or say done when finished.'
              );
            }
          } catch (error: any) {
            console.error('[UnhandledIntentHandler] Error adding task:', error);
            // Fall through to normal unhandled response
          }
        } else {
          // No task value but we're collecting - ask for clarification
          return buildResponse(
            handlerInput,
            'I didn\'t catch that task. Could you repeat it?',
            'Tell me the task again, or say done when finished.'
          );
        }
      }
    }
    
    // Check if this is a built-in Amazon intent
    if (intentName?.startsWith('AMAZON.')) {
      // Handle common Amazon intents
      if (intentName === 'AMAZON.HelpIntent') {
        return buildResponse(
          handlerInput,
          'I can help you manage your tasks in Notion. ' +
          'You can add tasks, list your tasks, mark them complete, update their status, or delete them. ' +
          'You can also check your connection status. What would you like to do?',
          'What would you like to do?'
        );
      }
      
      if (intentName === 'AMAZON.StopIntent' || intentName === 'AMAZON.CancelIntent') {
        return handlerInput.responseBuilder
          .speak('Goodbye!')
          .withShouldEndSession(true)
          .getResponse();
      }
    }
    
    // Check if this might be a "mark as done" request that wasn't recognized
    // Look for patterns like "mark", "done", "complete" in the intent name or slots
    const user = attributes.user;
    const notionClient = attributes.notionClient;
    const taskSlot = request.intent?.slots?.task?.value;
    
    if (user && notionClient && taskSlot) {
      const taskSlotLower = taskSlot.toLowerCase();
      const intentNameLower = (intentName || '').toLowerCase();
      
      // Check if this looks like a "mark as done" request
      const looksLikeMarkDone = intentNameLower.includes('mark') || 
                                intentNameLower.includes('complete') ||
                                intentNameLower.includes('done') ||
                                taskSlotLower.includes('mark') ||
                                taskSlotLower.includes('done') ||
                                taskSlotLower.includes('complete');
      
      if (looksLikeMarkDone) {
        console.log('[UnhandledIntentHandler] Detected potential "mark as done" request, attempting to handle');
        try {
          const tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
          if (tasksDbId) {
            const allTasks = await getAllTasks(notionClient, tasksDbId);
            const matchingTask = findMatchingTask(taskSlot, allTasks);
            
            if (matchingTask) {
              console.log('[UnhandledIntentHandler] Found matching task, marking as complete:', matchingTask.name);
              await markTaskComplete(notionClient, matchingTask.id);
              return buildResponse(
                handlerInput,
                `Marked: ${matchingTask.name} as complete.`,
                'What else would you like to do?'
              );
            }
          }
        } catch (error: any) {
          console.error('[UnhandledIntentHandler] Error handling mark as done:', error);
        }
      }
    }
    
    // For other unhandled intents, provide helpful guidance
    const availableCommands = [
      'add a task',
      'list my tasks',
      'mark a task as complete',
      'update a task',
      'delete a task',
      'check connection status'
    ];
    
    return buildResponse(
      handlerInput,
      `I'm not sure how to help with that. In this MVP version, I can help you with task management. ` +
      `You can ${availableCommands.join(', ')}, or say "help" to learn more. ` +
      `What would you like to do?`,
      'What would you like to do?'
    );
  }
}



//////////   UpdateTaskStatusHandler.ts   //////////
import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse, cleanTaskName, findMatchingTask } from '../utils/alexa';
import { findDatabaseByName, getAllTasks, markTaskComplete } from '../utils/notion';
import { Client } from '@notionhq/client';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = MAX_RETRIES
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && (error.status === 429 || error.status >= 500)) {
      await sleep(RETRY_DELAY);
      return withRetry(fn, retries - 1);
    }
    throw error;
  }
}

async function updateTaskStatus(
  client: Client,
  pageId: string,
  status: 'To Do' | 'In Progress' | 'Done'
): Promise<void> {
  console.log('[updateTaskStatus] Starting update:', { pageId, targetStatus: status });
  
  // First, check if the task is deleted and restore it if needed
  try {
    const page = await client.pages.retrieve({ page_id: pageId });
    const props = (page as any).properties;
    const isDeleted = props.Deleted?.checkbox || false;
    const currentStatus = props.Status?.select?.name || 'Unknown';
    
    console.log('[updateTaskStatus] Current task state:', {
      isDeleted,
      currentStatus,
      targetStatus: status
    });
    
    if (isDeleted) {
      // Restore the task (set Deleted to false) and update status
      console.log('[updateTaskStatus] Restoring deleted task and updating status');
      const result = await withRetry(() =>
        client.pages.update({
          page_id: pageId,
          properties: {
            Deleted: {
              checkbox: false,
            },
            Status: {
              select: { name: status },
            },
          },
        })
      );
      console.log('[updateTaskStatus] Task restored and status updated');
      return;
    } else {
      // Just update the status
      console.log('[updateTaskStatus] Updating status only');
      const result = await withRetry(() =>
        client.pages.update({
          page_id: pageId,
          properties: {
            Status: {
              select: { name: status },
            },
          },
        })
      );
      console.log('[updateTaskStatus] Status update call completed');
      return;
    }
  } catch (error: any) {
    // If we can't retrieve the page, try to update anyway (fallback)
    console.warn('[updateTaskStatus] Could not check deleted status, updating anyway:', {
      message: error.message,
      status: error.status,
      code: error.code
    });
    
    try {
      const result = await withRetry(() =>
        client.pages.update({
          page_id: pageId,
          properties: {
            Status: {
              select: { name: status },
            },
          },
        })
      );
      console.log('[updateTaskStatus] Fallback status update completed');
    } catch (fallbackError: any) {
      console.error('[updateTaskStatus] Fallback update also failed:', {
        message: fallbackError.message,
        status: fallbackError.status,
        code: fallbackError.code
      });
      throw fallbackError; // Re-throw so the caller knows it failed
    }
  }
}

export class UpdateTaskStatusHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest 
      ? (handlerInput.requestEnvelope.request as any).intent?.name 
      : null;
    
    // Only handle UpdateTaskStatusIntent - MarkTaskCompleteIntent should be handled by MarkTaskCompleteHandler
    const canHandle = isIntentRequest && intentName === 'UpdateTaskStatusIntent';
    
    if (isIntentRequest) {
      console.log('[UpdateTaskStatusHandler] canHandle check:', {
        isIntentRequest,
        intentName,
        canHandle,
        willHandle: canHandle ? 'YES' : 'NO'
      });
    }
    
    return canHandle;
  }

  async handle(handlerInput: HandlerInput) {
    console.log('[UpdateTaskStatusHandler] Handler invoked');
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;
    
    console.log('[UpdateTaskStatusHandler] Session check:', {
      hasUser: !!user,
      hasNotionClient: !!notionClient,
      userId: user?.id
    });

    if (!user || !notionClient) {
      return buildResponse(
        handlerInput,
        'To update task status, you need to connect your Notion account. ' +
        'Open the Alexa app, go to Skills, find Notion Data, and click Link Account. ' +
        'Once connected, you can update your tasks.',
        'What would you like to do?'
      );
    }

    try {
      const request = handlerInput.requestEnvelope.request as any;
      const intentName = request.intent?.name;
      const taskSlot = request.intent.slots?.task?.value;
      const statusSlot = request.intent.slots?.status?.value;

      console.log('[UpdateTaskStatusHandler] Intent name:', intentName);
      console.log('[UpdateTaskStatusHandler] Task slot:', taskSlot);
      console.log('[UpdateTaskStatusHandler] Status slot:', statusSlot);
      console.log('[UpdateTaskStatusHandler] Full request envelope:', JSON.stringify(handlerInput.requestEnvelope, null, 2));

      // PRIMARY HANDLING: Check if this is a "mark X as done" request
      // This handles cases where "mark X as done" is routed to UpdateTaskStatusIntent
      // We check this FIRST before doing any status detection
      if (taskSlot) {
        const taskSlotLower = taskSlot.toLowerCase();
        const fullRequestString = JSON.stringify(handlerInput.requestEnvelope.request);
        const fullRequestLower = fullRequestString.toLowerCase();
        
        // Get raw input/utterance for better detection
        const rawInput = (request as any).input?.text || 
                       (handlerInput.requestEnvelope.request as any).rawInput || 
                       (handlerInput.requestEnvelope.request as any).input?.originalText ||
                       '';
        const rawInputLower = rawInput.toLowerCase();
        
        // Comprehensive detection of "mark as done" patterns
        const isMarkAsDonePattern = 
          // Pattern 1: Task slot contains "as done" or "as complete"
          (taskSlotLower.includes('as done') || taskSlotLower.includes('as complete')) ||
          // Pattern 2: Full request contains "mark" AND ("as done" or "as complete")
          (fullRequestLower.includes('mark') && (fullRequestLower.includes('as done') || fullRequestLower.includes('as complete'))) ||
          // Pattern 3: Raw input contains "mark" AND ("as done" or "as complete")
          (rawInputLower.includes('mark') && (rawInputLower.includes('as done') || rawInputLower.includes('as complete'))) ||
          // Pattern 4: Intent name is MarkTaskCompleteIntent (incorrectly routed)
          intentName === 'MarkTaskCompleteIntent' ||
          // Pattern 5: Task slot starts with "mark" and contains "done" or "complete"
          (taskSlotLower.startsWith('mark') && (taskSlotLower.includes('done') || taskSlotLower.includes('complete'))) ||
          // Pattern 6: Full request has "mark" followed by task name and "done"/"complete"
          (fullRequestLower.includes('mark') && fullRequestLower.includes('finish') && (fullRequestLower.includes('done') || fullRequestLower.includes('complete')));
        
        console.log('[UpdateTaskStatusHandler] Checking for "mark as done" pattern:', {
          taskSlotLower,
          rawInputLower,
          hasMarkInRequest: fullRequestLower.includes('mark'),
          hasAsDoneInRequest: fullRequestLower.includes('as done'),
          hasAsCompleteInRequest: fullRequestLower.includes('as complete'),
          hasDoneInRequest: fullRequestLower.includes('done'),
          hasCompleteInRequest: fullRequestLower.includes('complete'),
          intentName,
          isMarkAsDonePattern
        });
        
        if (isMarkAsDonePattern) {
          console.log('[UpdateTaskStatusHandler] ========== DETECTED "mark as done" PATTERN ==========');
          console.log('[UpdateTaskStatusHandler] Handling as MarkTaskCompleteIntent');
          
          const tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
          if (!tasksDbId) {
            return buildResponse(
              handlerInput,
              'I couldn\'t find your Tasks database in Notion. Please make sure it exists and try again.',
              'What would you like to do?'
            );
          }
          
          // Clean the task name - remove "mark", "as done", "as complete" etc.
          let cleanedTaskName = cleanTaskName(taskSlot);
          
          // Additional cleaning for "mark as done" patterns
          cleanedTaskName = cleanedTaskName
            .replace(/^mark\s+/i, '')  // Remove "mark " prefix
            .replace(/\s+as\s+done$/i, '')  // Remove " as done" suffix
            .replace(/\s+as\s+complete$/i, '')  // Remove " as complete" suffix
            .replace(/\s+done$/i, '')  // Remove " done" suffix
            .replace(/\s+complete$/i, '')  // Remove " complete" suffix
            .trim();
          
          console.log('[UpdateTaskStatusHandler] Cleaned task name for mark as done:', cleanedTaskName);
          
          const allTasks = await getAllTasks(notionClient, tasksDbId);
          const matchingTask = findMatchingTask(cleanedTaskName, allTasks);
          
          if (!matchingTask) {
            console.log('[UpdateTaskStatusHandler] No matching task found for:', cleanedTaskName);
            return buildResponse(
              handlerInput,
              `I couldn't find "${cleanedTaskName}" in your tasks. Please try saying the full task name.`,
              'What else would you like to do?'
            );
          }
          
          console.log('[UpdateTaskStatusHandler] Marking task as complete:', {
            taskId: matchingTask.id,
            taskName: matchingTask.name,
            currentStatus: matchingTask.status
          });
          
          try {
            await markTaskComplete(notionClient, matchingTask.id);
            
            // Verify the update
            try {
              const updatedPage = await notionClient.pages.retrieve({ page_id: matchingTask.id });
              const updatedProps = (updatedPage as any).properties;
              const actualStatus = updatedProps.Status?.select?.name || 'Unknown';
              console.log('[UpdateTaskStatusHandler] Status update verified:', {
                expectedStatus: 'Done',
                actualStatus: actualStatus,
                match: actualStatus === 'Done'
              });
              
              if (actualStatus !== 'Done') {
                console.error('[UpdateTaskStatusHandler] Status mismatch! Expected: Done, Got:', actualStatus);
                return buildResponse(
                  handlerInput,
                  `I tried to mark ${matchingTask.name} as complete, but there was an issue. The task status is currently ${actualStatus}.`,
                  'What else would you like to do?'
                );
              }
            } catch (verifyError: any) {
              console.warn('[UpdateTaskStatusHandler] Could not verify status update:', verifyError.message);
              // Continue anyway - the update might have succeeded
            }
            
            console.log('[UpdateTaskStatusHandler] Task marked as complete successfully');
            return buildResponse(
              handlerInput,
              `Marked: ${matchingTask.name} as complete.`,
              'What else would you like to do?'
            );
          } catch (markError: any) {
            console.error('[UpdateTaskStatusHandler] Error in markTaskComplete call:', {
              message: markError?.message,
              status: markError?.status,
              code: markError?.code,
              stack: markError?.stack
            });
            return buildResponse(
              handlerInput,
              `I encountered an error marking ${matchingTask.name} as complete. Please try again.`,
              'What else would you like to do?'
            );
          }
        }
      }

      if (!taskSlot || taskSlot.trim().length === 0) {
        return buildResponse(
          handlerInput,
          'Which task would you like to update?',
          'Tell me the task name.'
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

      // Detect target status from:
      // 1. Status slot (if provided)
      // 2. Task slot or utterance (e.g., "set task to done")
      // 3. Current task status (smart defaults)
      
      const taskSlotLower = taskSlot.toLowerCase();
      const statusSlotLower = statusSlot?.toLowerCase() || '';
      
      // Try to get the original utterance from various sources
      const rawInput = (request as any).input?.text || 
                     (handlerInput.requestEnvelope.request as any).rawInput || 
                     (handlerInput.requestEnvelope.request as any).input?.originalText ||
                     '';
      const rawInputLower = rawInput.toLowerCase();
      
      // Also check the full request envelope for any utterance data
      const requestEnvelope = handlerInput.requestEnvelope as any;
      const utterance = requestEnvelope.request?.input?.text || 
                       requestEnvelope.request?.rawInput || 
                       '';
      const utteranceLower = utterance.toLowerCase();
      
      // Combine all sources for detection
      const allText = `${taskSlotLower} ${statusSlotLower} ${rawInputLower} ${utteranceLower}`.toLowerCase();
      
      // Also check the full request envelope for any utterance data
      const fullRequest = handlerInput.requestEnvelope.request as any;
      const fullRequestString = JSON.stringify(fullRequest);
      const fullRequestLower = fullRequestString.toLowerCase();
      
      console.log('[UpdateTaskStatusHandler] Detection check:', {
        taskSlot: taskSlot,
        statusSlot: statusSlot,
        rawInput: rawInput,
        utterance: utterance,
        allText: allText,
        fullRequestLower: fullRequestLower.substring(0, 500), // First 500 chars for logging
        hasToDone: fullRequestLower.includes('to done'),
        hasToComplete: fullRequestLower.includes('to complete'),
        hasToInProgress: fullRequestLower.includes('to in progress'),
        hasToToDo: fullRequestLower.includes('to to do') || fullRequestLower.includes('to todo')
      });
      
      // Detect target status from various sources
      let targetStatus: 'To Do' | 'In Progress' | 'Done' | null = null;
      
      // 1. Check status slot first
      if (statusSlot) {
        const statusLower = statusSlotLower;
        if (statusLower.includes('to do') || statusLower.includes('todo') || statusLower === 'to do') {
          targetStatus = 'To Do';
        } else if (statusLower.includes('in progress') || statusLower.includes('in-progress') || statusLower === 'in progress') {
          targetStatus = 'In Progress';
        } else if (statusLower.includes('done') || statusLower.includes('complete')) {
          targetStatus = 'Done';
        }
      }
      
      // 2. Check utterance for status keywords - prioritize explicit status phrases
      // This MUST happen before smart defaults to respect user's explicit intent
      if (!targetStatus) {
        // Priority 1: Check for explicit "to [status]" patterns in fullRequestLower (most comprehensive)
        // This is the most reliable pattern - user explicitly says "to in progress", "to done", etc.
        if (fullRequestLower.includes('to in progress') || fullRequestLower.includes('to in-progress')) {
          targetStatus = 'In Progress';
          console.log('[UpdateTaskStatusHandler] Detected EXPLICIT "In Progress" from "to in progress" pattern');
        } else if (fullRequestLower.includes('to to do') || fullRequestLower.includes('to todo')) {
          targetStatus = 'To Do';
          console.log('[UpdateTaskStatusHandler] Detected EXPLICIT "To Do" from "to to do" pattern');
        } else if (fullRequestLower.includes('to done') || fullRequestLower.includes('to complete')) {
          targetStatus = 'Done';
          console.log('[UpdateTaskStatusHandler] Detected EXPLICIT "Done" from "to done" pattern');
        }
        
        // Priority 2: Check for "set/move [task] to [status]" patterns
        // User says "set X to in progress" or "move X to done"
        if (!targetStatus) {
          if ((fullRequestLower.includes('set') || fullRequestLower.includes('move')) && 
              (fullRequestLower.includes('to in progress') || fullRequestLower.includes('to in-progress') || 
               fullRequestLower.includes('in progress'))) {
            targetStatus = 'In Progress';
            console.log('[UpdateTaskStatusHandler] Detected EXPLICIT "In Progress" from "set/move ... to in progress" pattern');
          } else if ((fullRequestLower.includes('set') || fullRequestLower.includes('move')) && 
                     (fullRequestLower.includes('to to do') || fullRequestLower.includes('to todo') ||
                      fullRequestLower.includes('to do') || fullRequestLower.includes('todo'))) {
            targetStatus = 'To Do';
            console.log('[UpdateTaskStatusHandler] Detected EXPLICIT "To Do" from "set/move ... to do" pattern');
          } else if ((fullRequestLower.includes('set') || fullRequestLower.includes('move')) && 
                     (fullRequestLower.includes('to done') || fullRequestLower.includes('to complete') ||
                      fullRequestLower.includes('done') || fullRequestLower.includes('complete'))) {
            targetStatus = 'Done';
            console.log('[UpdateTaskStatusHandler] Detected EXPLICIT "Done" from "set/move ... done" pattern');
          }
        }
        
        // Priority 3: Check allText and other sources for explicit patterns
        if (!targetStatus) {
          if (allText.includes('to in progress') || allText.includes('to in-progress')) {
            targetStatus = 'In Progress';
            console.log('[UpdateTaskStatusHandler] Detected EXPLICIT "In Progress" from allText');
          } else if (allText.includes('to to do') || allText.includes('to todo')) {
            targetStatus = 'To Do';
            console.log('[UpdateTaskStatusHandler] Detected EXPLICIT "To Do" from allText');
          } else if (allText.includes('to done') || allText.includes('to complete')) {
            targetStatus = 'Done';
            console.log('[UpdateTaskStatusHandler] Detected EXPLICIT "Done" from allText');
          } else if (rawInputLower.includes('to in progress') || rawInputLower.includes('to in-progress')) {
            targetStatus = 'In Progress';
            console.log('[UpdateTaskStatusHandler] Detected EXPLICIT "In Progress" from rawInput');
          } else if (utteranceLower.includes('to in progress') || utteranceLower.includes('to in-progress')) {
            targetStatus = 'In Progress';
            console.log('[UpdateTaskStatusHandler] Detected EXPLICIT "In Progress" from utterance');
          }
        }
        
        // Priority 4: Fallback to general keywords (less specific, but still explicit)
        // Only use if no explicit "to [status]" pattern was found
        if (!targetStatus) {
          // Check for standalone status keywords in context of "set" or "move"
          if ((fullRequestLower.includes('set') || fullRequestLower.includes('move')) &&
              (allText.includes('in progress') || allText.includes('in-progress') || allText.includes('start') || allText.includes('begin'))) {
            targetStatus = 'In Progress';
            console.log('[UpdateTaskStatusHandler] Detected "In Progress" from keywords with set/move');
          } else if ((fullRequestLower.includes('set') || fullRequestLower.includes('move')) &&
                     (allText.includes('to do') || allText.includes('todo'))) {
            targetStatus = 'To Do';
            console.log('[UpdateTaskStatusHandler] Detected "To Do" from keywords with set/move');
          } else if ((fullRequestLower.includes('set') || fullRequestLower.includes('move')) &&
                     (allText.includes('done') || allText.includes('complete'))) {
            targetStatus = 'Done';
            console.log('[UpdateTaskStatusHandler] Detected "Done" from keywords with set/move');
          }
        }
      }
      
      // 3. Check for "as done" or "as complete" patterns
      const isMarkingComplete = taskSlotLower.includes('as done') || 
                               taskSlotLower.includes('as complete') ||
                               rawInputLower.includes('as done') ||
                               rawInputLower.includes('as complete') ||
                               utteranceLower.includes('as done') ||
                               utteranceLower.includes('as complete') ||
                               fullRequestLower.includes('as done') ||
                               fullRequestLower.includes('as complete') ||
                               (allText.includes('mark') && (allText.includes('done') || allText.includes('complete'))) ||
                               (fullRequestLower.includes('mark') && (fullRequestLower.includes('done') || fullRequestLower.includes('complete')));
      
      if (isMarkingComplete && !targetStatus) {
        targetStatus = 'Done';
      }

      // Clean up the task name by removing command words
      const cleanedTaskName = cleanTaskName(taskSlot);
      console.log('[UpdateTaskStatusHandler] Original task slot:', taskSlot);
      console.log('[UpdateTaskStatusHandler] Cleaned task name:', cleanedTaskName);
      console.log('[UpdateTaskStatusHandler] Is marking complete:', isMarkingComplete);

      console.log('[UpdateTaskStatusHandler] Searching for task:', cleanedTaskName);
      
      const allTasks = await getAllTasks(notionClient, tasksDbId);
      console.log('[UpdateTaskStatusHandler] Found tasks:', allTasks.length);
      console.log('[UpdateTaskStatusHandler] Task names:', allTasks.map(t => t.name));

      // Hybrid matching: exact -> word token -> substring
      const matchingTask = findMatchingTask(cleanedTaskName, allTasks);

      console.log('[UpdateTaskStatusHandler] Matching task:', matchingTask ? {
        name: matchingTask.name,
        id: matchingTask.id,
        status: matchingTask.status
      } : 'none found');

      if (!matchingTask) {
        return buildResponse(
          handlerInput,
          `I couldn't find "${cleanedTaskName}" in your tasks. Please try saying the full task name.`,
          'What else would you like to do?'
        );
      }

      // Determine final target status
      // IMPORTANT: Only use smart defaults if NO explicit status was detected
      // If user explicitly said "to in progress", "to done", etc., always respect that
      const currentStatus = matchingTask.status;
      let isExplicitStatus = targetStatus !== null;
      
      // Check if we detected an explicit status from the utterance
      const hasExplicitStatusInUtterance = 
        fullRequestLower.includes('to in progress') ||
        fullRequestLower.includes('to in-progress') ||
        fullRequestLower.includes('to done') ||
        fullRequestLower.includes('to complete') ||
        fullRequestLower.includes('to to do') ||
        fullRequestLower.includes('to todo') ||
        (fullRequestLower.includes('set') && fullRequestLower.includes('in progress')) ||
        (fullRequestLower.includes('set') && fullRequestLower.includes('done')) ||
        (fullRequestLower.includes('set') && fullRequestLower.includes('to do')) ||
        (fullRequestLower.includes('set') && fullRequestLower.includes('todo')) ||
        allText.includes('to in progress') ||
        allText.includes('to done') ||
        allText.includes('to to do');
      
      if (hasExplicitStatusInUtterance && !targetStatus) {
        // Re-detect if we missed it
        if (fullRequestLower.includes('to in progress') || fullRequestLower.includes('to in-progress') ||
            (fullRequestLower.includes('set') && fullRequestLower.includes('in progress'))) {
          targetStatus = 'In Progress';
          isExplicitStatus = true;
          console.log('[UpdateTaskStatusHandler] Re-detected explicit "In Progress" from utterance');
        } else if (fullRequestLower.includes('to done') || fullRequestLower.includes('to complete') ||
                   (fullRequestLower.includes('set') && fullRequestLower.includes('done'))) {
          targetStatus = 'Done';
          isExplicitStatus = true;
          console.log('[UpdateTaskStatusHandler] Re-detected explicit "Done" from utterance');
        } else if (fullRequestLower.includes('to to do') || fullRequestLower.includes('to todo') ||
                   (fullRequestLower.includes('set') && (fullRequestLower.includes('to do') || fullRequestLower.includes('todo')))) {
          targetStatus = 'To Do';
          isExplicitStatus = true;
          console.log('[UpdateTaskStatusHandler] Re-detected explicit "To Do" from utterance');
        }
      }
      
      // Only use smart defaults if NO explicit status was detected
      // CRITICAL: Smart defaults should NEVER override explicit user intent
      if (!targetStatus && !isExplicitStatus) {
        console.log('[UpdateTaskStatusHandler] No explicit status detected, using smart defaults');
        // Smart defaults:
        // - If "To Do" → set to "In Progress" (natural next step)
        // - If "In Progress" → set to "Done" (natural next step)
        // - If "Done" → set to "To Do" (restart cycle)
        if (currentStatus === 'To Do') {
          targetStatus = 'In Progress';
        } else if (currentStatus === 'In Progress') {
          targetStatus = 'Done';
        } else if (currentStatus === 'Done') {
          targetStatus = 'To Do';
        } else {
          // Default to "In Progress" if status is unknown
          targetStatus = 'In Progress';
        }
      } else if (targetStatus) {
        console.log('[UpdateTaskStatusHandler] Explicit status detected:', {
          targetStatus,
          currentStatus,
          willRespectExplicitStatus: true
        });
      }
      
      // Ensure targetStatus is never null at this point
      if (!targetStatus) {
        // Final fallback - should never reach here, but safety check
        console.warn('[UpdateTaskStatusHandler] targetStatus is still null, defaulting to In Progress');
        targetStatus = 'In Progress';
      }

      console.log('[UpdateTaskStatusHandler] Final status decision:', {
        statusSlot: statusSlot,
        detectedStatus: targetStatus,
        currentStatus: matchingTask.status,
        isExplicitStatus,
        hasExplicitStatusInUtterance,
        isMarkingComplete,
        willUpdateTo: targetStatus,
        willChangeStatus: targetStatus !== currentStatus,
        usingSmartDefaults: !isExplicitStatus && !hasExplicitStatusInUtterance
      });
      
      // If explicit status matches current status, log but still update (user's explicit request)
      if (isExplicitStatus && targetStatus === currentStatus) {
        console.log('[UpdateTaskStatusHandler] Explicit status matches current status, updating anyway per user request');
      }

      // Update to the target status
      if (targetStatus === 'Done') {
        console.log('[UpdateTaskStatusHandler] Marking task as complete:', {
          taskId: matchingTask.id,
          taskName: matchingTask.name,
          currentStatus: matchingTask.status,
          targetStatus: targetStatus
        });
        await markTaskComplete(notionClient, matchingTask.id);
        console.log('[UpdateTaskStatusHandler] Task marked as complete successfully');
        return buildResponse(
          handlerInput,
          `Marked: ${matchingTask.name} as complete.`,
          'What else would you like to do?'
        );
      } else {
        console.log('[UpdateTaskStatusHandler] Setting task status:', {
          taskId: matchingTask.id,
          taskName: matchingTask.name,
          currentStatus: matchingTask.status,
          targetStatus: targetStatus
        });
        
        try {
          await updateTaskStatus(notionClient, matchingTask.id, targetStatus);
          
          // Verify the update succeeded by retrieving the page
          try {
            const updatedPage = await notionClient.pages.retrieve({ page_id: matchingTask.id });
            const updatedProps = (updatedPage as any).properties;
            const actualStatus = updatedProps.Status?.select?.name || 'Unknown';
            console.log('[UpdateTaskStatusHandler] Status update verified:', {
              expectedStatus: targetStatus,
              actualStatus: actualStatus,
              match: actualStatus === targetStatus
            });
            
            if (actualStatus !== targetStatus) {
              console.error('[UpdateTaskStatusHandler] Status mismatch! Expected:', targetStatus, 'Got:', actualStatus);
              return buildResponse(
                handlerInput,
                `I tried to update ${matchingTask.name} to ${targetStatus}, but there was an issue. The task status is currently ${actualStatus}.`,
                'What else would you like to do?'
              );
            }
          } catch (verifyError: any) {
            console.warn('[UpdateTaskStatusHandler] Could not verify status update:', verifyError.message);
            // Continue anyway - the update might have succeeded
          }
          
          console.log('[UpdateTaskStatusHandler] Task status updated successfully');
          const statusText = targetStatus === 'To Do' ? 'to do' : 'in progress';
          return buildResponse(
            handlerInput,
            `Updated: ${matchingTask.name} to ${statusText}.`,
            'What else would you like to do?'
          );
        } catch (updateError: any) {
          console.error('[UpdateTaskStatusHandler] Error in updateTaskStatus call:', {
            message: updateError?.message,
            status: updateError?.status,
            code: updateError?.code,
            stack: updateError?.stack
          });
          throw updateError; // Re-throw to be caught by outer catch
        }
      }
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
        'I encountered an error updating your task. Please try again.',
        'What would you like to do?'
      );
    }
  }
}



///////////////   src/index.ts ///////////////
import { SkillBuilders } from 'ask-sdk-core';
import { RequestEnvelope } from 'ask-sdk-model';
import { LaunchRequestHandler } from './handlers/LaunchRequestHandler';
import { TaskListHandler } from './handlers/TaskListHandler';
import { AddTaskHandler } from './handlers/AddTaskHandler';
import { MarkTaskCompleteHandler } from './handlers/MarkTaskCompleteHandler';
import { UpdateTaskStatusHandler } from './handlers/UpdateTaskStatusHandler';
import { DeleteTaskHandler } from './handlers/DeleteTaskHandler';
import { ConnectionStatusHandler } from './handlers/ConnectionStatusHandler';
import { BrainDumpHandler } from './handlers/BrainDumpHandler';
import { UnhandledIntentHandler } from './handlers/UnhandledIntentHandler';
import { SessionEndedHandler } from './handlers/SessionEndedHandler';
import { ErrorHandler } from './handlers/ErrorHandler';
// import { PriorityListHandler } from './handlers/PriorityListHandler';
// import { FocusTimerHandler } from './handlers/FocusTimerHandler';
// import { EnergyTrackerHandler } from './handlers/EnergyTrackerHandler';
// import { ScheduleHandler } from './handlers/ScheduleHandler';
// import { ShoppingListHandler } from './handlers/ShoppingListHandler';
import { NotionConnectionInterceptor } from './interceptors/NotionConnectionInterceptor';

export const handler = SkillBuilders.custom()
  .addRequestHandlers(
    new LaunchRequestHandler(),
    // MVP: Core Task CRUD operations only
    new TaskListHandler(),
    new BrainDumpHandler(), // Must be before AddTaskHandler to handle BrainDumpIntent
    new AddTaskHandler(),
    new MarkTaskCompleteHandler(),
    new UpdateTaskStatusHandler(),
    new DeleteTaskHandler(),
    new ConnectionStatusHandler(),
    // MVP: Non-essential handlers disabled
    // new PriorityListHandler(),
    // new FocusTimerHandler(),
    // new EnergyTrackerHandler(),
    // new ScheduleHandler(),
    // new ShoppingListHandler(),
    new UnhandledIntentHandler(), // Must be before SessionEndedHandler
    new SessionEndedHandler()
  )
  .addRequestInterceptors(
    // Logging interceptor - runs first
    {
      async process(handlerInput: any) {
        try {
          const request = handlerInput.requestEnvelope.request;
          const userId = handlerInput.requestEnvelope.session?.user?.userId;
          console.log('[Request Interceptor] Request type:', request.type);
          console.log('[Request Interceptor] User ID:', userId);
          console.log('[Request Interceptor] Request ID:', handlerInput.requestEnvelope.request.requestId);
          console.log('[Request Interceptor] Session ID:', handlerInput.requestEnvelope.session?.sessionId);
          
          // Log intent details if it's an IntentRequest
          if (request.type === 'IntentRequest') {
            const intent = (request as any).intent;
            console.log('[Request Interceptor] Intent name:', intent?.name);
            console.log('[Request Interceptor] Intent slots:', JSON.stringify(intent?.slots || {}));
            console.log('[Request Interceptor] Intent confirmation status:', intent?.confirmationStatus);
            
            // Also log raw input if available to help debug routing issues
            const rawInput = (request as any).input?.text || (request as any).rawInput || '';
            if (rawInput) {
              console.log('[Request Interceptor] Raw input:', rawInput);
            }
          }
        } catch (error: any) {
          console.error('[Request Interceptor] Error in logging:', error?.message);
          // Don't throw - just log and continue
        }
      }
    },
    // License validation disabled for MVP - focus on CRUD operations only
    // new LicenseValidationInterceptor(), // Disabled for MVP
    new NotionConnectionInterceptor()
  )
  .addErrorHandlers(new ErrorHandler())
  .withCustomUserAgent('notion-assistant-skill/v1.0')
  .lambda();
