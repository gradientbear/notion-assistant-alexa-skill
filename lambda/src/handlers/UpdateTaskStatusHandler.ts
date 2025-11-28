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

