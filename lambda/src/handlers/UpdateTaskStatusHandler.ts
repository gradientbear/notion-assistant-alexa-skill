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
  // First, check if the task is deleted and restore it if needed
  try {
    const page = await client.pages.retrieve({ page_id: pageId });
    const props = (page as any).properties;
    const isDeleted = props.Deleted?.checkbox || false;
    
    if (isDeleted) {
      // Restore the task (set Deleted to false) and update status
      await withRetry(() =>
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
    } else {
      // Just update the status
      await withRetry(() =>
        client.pages.update({
          page_id: pageId,
          properties: {
            Status: {
              select: { name: status },
            },
          },
        })
      );
    }
  } catch (error: any) {
    // If we can't retrieve the page, try to update anyway (fallback)
    console.warn('[updateTaskStatus] Could not check deleted status, updating anyway:', error.message);
    await withRetry(() =>
      client.pages.update({
        page_id: pageId,
        properties: {
          Status: {
            select: { name: status },
          },
        },
      })
    );
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
        allText: allText
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
      
      // 2. Check utterance for status keywords
      if (!targetStatus) {
        if (allText.includes('to do') || allText.includes('todo') || allText.includes('set to to do')) {
          targetStatus = 'To Do';
        } else if (allText.includes('in progress') || allText.includes('in-progress') || allText.includes('start') || allText.includes('begin')) {
          targetStatus = 'In Progress';
        } else if (allText.includes('done') || allText.includes('complete') || allText.includes('as done') || allText.includes('as complete')) {
          targetStatus = 'Done';
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
      // If no explicit status detected, use smart defaults based on current status
      if (!targetStatus) {
        const currentStatus = matchingTask.status;
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
      }

      console.log('[UpdateTaskStatusHandler] Status decision:', {
        statusSlot: statusSlot,
        detectedStatus: targetStatus,
        currentStatus: matchingTask.status,
        isMarkingComplete,
        willUpdateTo: targetStatus
      });

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
        await updateTaskStatus(notionClient, matchingTask.id, targetStatus);
        console.log('[UpdateTaskStatusHandler] Task status updated successfully');
        
        const statusText = targetStatus === 'To Do' ? 'to do' : 'in progress';
        return buildResponse(
          handlerInput,
          `Updated: ${matchingTask.name} to ${statusText}.`,
          'What else would you like to do?'
        );
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

