import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse, cleanTaskName, findMatchingTask } from '../utils/alexa';
import { findDatabaseByName, getAllTasks, updateTask } from '../utils/notion';
import { parseTaskFromUserRequest } from '../utils/parsing';

export class UpdateTaskHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest 
      ? (handlerInput.requestEnvelope.request as any).intent?.name 
      : null;
    
    const canHandle = isIntentRequest && intentName === 'UpdateTaskIntent';
    
    if (isIntentRequest) {
      console.log('[UpdateTaskHandler] canHandle check:', {
        isIntentRequest,
        intentName,
        canHandle
      });
    }
    
    return canHandle;
  }

  async handle(handlerInput: HandlerInput) {
    console.log('[UpdateTaskHandler] Handler invoked');
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;
    
    console.log('[UpdateTaskHandler] Session check:', {
      hasUser: !!user,
      hasNotionClient: !!notionClient,
      userId: user?.id
    });

    if (!user || !notionClient) {
      return buildResponse(
        handlerInput,
        'To update tasks, you need to connect your Notion account. ' +
        'Open the Alexa app, go to Skills, find Voice Planner, and click Link Account. ' +
        'Once connected, you can update your tasks.',
        'What would you like to do?'
      );
    }

    try {
      const request = handlerInput.requestEnvelope.request as any;
      const slots = request.intent.slots || {};
      
      // Extract userRequest from AMAZON.SearchQuery slot
      const userRequest = slots.userRequest?.value;

      console.log('[UpdateTaskHandler] Intent name:', request.intent.name);
      console.log('[UpdateTaskHandler] userRequest:', userRequest);

      if (!userRequest || userRequest.trim().length === 0) {
        return buildResponse(
          handlerInput,
          'What task would you like to update?',
          'Tell me which task to update and what to change.'
        );
      }

      // Try to use stored database ID first, fallback to search
      let tasksDbId = user.tasks_db_id || null;
      
      if (!tasksDbId) {
        console.log('[UpdateTaskHandler] tasks_db_id not found in user record, searching by name...');
        tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
      } else {
        console.log('[UpdateTaskHandler] Using stored tasks_db_id:', tasksDbId);
      }
      
      if (!tasksDbId) {
        return buildResponse(
          handlerInput,
          'I couldn\'t find your Tasks database in Notion. Please make sure it exists and try again.',
          'What would you like to do?'
        );
      }

      // Parse the update request to extract task name and updates
      const parsed = parseTaskFromUserRequest(userRequest);
      const lowerRequest = userRequest.toLowerCase();
      
      // Extract task name (remove update keywords)
      let taskNameText = userRequest;
      const updateKeywords = ['update', 'change', 'modify', 'set', 'move', 'reschedule', 'rename'];
      for (const keyword of updateKeywords) {
        taskNameText = taskNameText.replace(new RegExp(`^${keyword}\\s+`, 'i'), '');
      }
      
      // Clean task name
      const cleanedTaskName = cleanTaskName(taskNameText);
      
      console.log('[UpdateTaskHandler] Parsed update:', {
        cleanedTaskName,
        parsedStatus: parsed.status,
        parsedPriority: parsed.priority,
        parsedDueDateTime: parsed.dueDateTime
      });

      // Get all tasks to find matching task
      const allTasks = await getAllTasks(notionClient, tasksDbId);
      const matchingTask = findMatchingTask(cleanedTaskName, allTasks);
      
      if (!matchingTask) {
        console.log('[UpdateTaskHandler] No matching task found for:', cleanedTaskName);
        return buildResponse(
          handlerInput,
          `I couldn't find "${cleanedTaskName}" in your tasks. Please try saying the full task name.`,
          'What else would you like to do?'
        );
      }

      console.log('[UpdateTaskHandler] Found matching task:', {
        taskId: matchingTask.id,
        taskName: matchingTask.name,
        currentStatus: matchingTask.status,
        currentPriority: matchingTask.priority,
        currentDueDateTime: matchingTask.dueDateTime
      });

      // Build update object
      const updates: {
        status?: 'TO DO' | 'IN_PROCESS' | 'DONE';
        priority?: 'LOW' | 'NORMAL' | 'HIGH';
        dueDateTime?: string | null;
      } = {};

      // Determine what to update based on parsed values and request text
      if (parsed.status && parsed.status !== matchingTask.status) {
        updates.status = parsed.status;
      }
      
      if (parsed.priority && parsed.priority !== matchingTask.priority) {
        updates.priority = parsed.priority;
      }
      
      if (parsed.dueDateTime !== undefined && parsed.dueDateTime !== matchingTask.dueDateTime) {
        updates.dueDateTime = parsed.dueDateTime;
      }

      // If no updates detected, try to infer from keywords
      if (Object.keys(updates).length === 0) {
        if (lowerRequest.includes('done') || lowerRequest.includes('complete') || lowerRequest.includes('finish')) {
          updates.status = 'DONE';
        } else if (lowerRequest.includes('in progress') || lowerRequest.includes('working on')) {
          updates.status = 'IN_PROCESS';
        } else if (lowerRequest.includes('to do') || lowerRequest.includes('todo')) {
          updates.status = 'TO DO';
        }
        
        if (lowerRequest.includes('high priority') || lowerRequest.includes('urgent')) {
          updates.priority = 'HIGH';
        } else if (lowerRequest.includes('low priority') || lowerRequest.includes('low')) {
          updates.priority = 'LOW';
        } else if (lowerRequest.includes('normal priority') || lowerRequest.includes('medium priority')) {
          updates.priority = 'NORMAL';
        }
      }

      if (Object.keys(updates).length === 0) {
        return buildResponse(
          handlerInput,
          `I found "${matchingTask.name}", but I'm not sure what you'd like to update. ` +
          'You can update the status, priority, or due date. For example, say "mark it as done" or "set priority to high".',
          'What would you like to do?'
        );
      }

      // Update the task
      await updateTask(notionClient, matchingTask.id, updates);

      // Build confirmation message
      const updateParts: string[] = [];
      if (updates.status) {
        const statusText = updates.status === 'DONE' ? 'done' : 
                          updates.status === 'IN_PROCESS' ? 'in progress' : 'to do';
        updateParts.push(`status to ${statusText}`);
      }
      if (updates.priority) {
        const priorityText = updates.priority === 'HIGH' ? 'high' :
                            updates.priority === 'LOW' ? 'low' : 'normal';
        updateParts.push(`priority to ${priorityText}`);
      }
      if (updates.dueDateTime) {
        const dueDate = new Date(updates.dueDateTime);
        const dateStr = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const hours = dueDate.getHours();
        const minutes = dueDate.getMinutes();
        if (hours !== 0 || minutes !== 0) {
          const timeStr = dueDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
          updateParts.push(`due date to ${dateStr} at ${timeStr}`);
        } else {
          updateParts.push(`due date to ${dateStr}`);
        }
      }

      const confirmation = `Updated "${matchingTask.name}": ${updateParts.join(', ')}.`;

      return buildResponse(handlerInput, confirmation, 'What else would you like to do?');
    } catch (error: any) {
      console.error('[UpdateTaskHandler] Error updating task:', error);
      console.error('[UpdateTaskHandler] Error details:', {
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

