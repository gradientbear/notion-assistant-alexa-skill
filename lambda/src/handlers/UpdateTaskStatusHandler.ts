import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse, cleanTaskName, findMatchingTask } from '../utils/alexa';
import { findDatabaseByName, getAllTasks, updateTaskStatus, markTaskComplete } from '../utils/notion';

export class UpdateTaskStatusHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest 
      ? (handlerInput.requestEnvelope.request as any).intent?.name 
      : null;
    
    // Handle both UpdateTaskStatusPhraseIntent and UpdateTaskStatusStructuredIntent
    const canHandle = isIntentRequest && (
      intentName === 'UpdateTaskStatusPhraseIntent' || 
      intentName === 'UpdateTaskStatusStructuredIntent'
    );
    
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
        'Open the Alexa app, go to Skills, find Voice Planner, and click Link Account. ' +
        'Once connected, you can update your tasks.',
        'What would you like to do?'
      );
    }

    try {
      const request = handlerInput.requestEnvelope.request as any;
      const intentName = request.intent?.name;
      const slots = request.intent.slots || {};
      // Handle both Phrase (taskName) and Structured (taskNameValue) intents
      const taskNameSlot = slots.taskName?.value || slots.taskNameValue?.value;
      const statusSlot = slots.status?.value;

      console.log('[UpdateTaskStatusHandler] Intent name:', intentName);
      console.log('[UpdateTaskStatusHandler] Task slot:', taskNameSlot);
      console.log('[UpdateTaskStatusHandler] Status slot:', statusSlot);
      console.log('[UpdateTaskStatusHandler] Full request envelope:', JSON.stringify(handlerInput.requestEnvelope, null, 2));

      const fullRequestString = JSON.stringify(handlerInput.requestEnvelope.request);
      const fullRequestLower = fullRequestString.toLowerCase();
      
      // PRIMARY HANDLING: Check if this is a "mark X as done" request
      // This handles cases where "mark X as done" is routed to UpdateTaskStatusIntent
      // We check this FIRST before doing any status detection
      if (taskNameSlot) {
        const taskSlotLower = taskNameSlot?.toLowerCase() || '';
        
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
          let cleanedTaskName = cleanTaskName(taskNameSlot);
          
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

      if (!taskNameSlot || taskNameSlot.trim().length === 0) {
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

      // Get status from slot - normalize to new format
      if (!statusSlot) {
        return buildResponse(
          handlerInput,
          'What status would you like to set?',
          'Tell me the status: to do, in progress, or done.'
        );
      }

      const normalizeStatus = (s: string): 'to do' | 'in progress' | 'done' => {
        const normalized = s.toLowerCase();
        if (normalized === 'to do' || normalized === 'todo' || normalized === 'to-do') return 'to do';
        if (normalized === 'in progress' || normalized === 'in-progress' || normalized === 'doing') return 'in progress';
        if (normalized === 'done' || normalized === 'complete' || normalized === 'completed') return 'done';
        return 'to do'; // default
      };

      const targetStatus = normalizeStatus(statusSlot);

      // Clean up the task name
      const cleanedTaskName = cleanTaskName(taskNameSlot || '');
      console.log('[UpdateTaskStatusHandler] Task name:', cleanedTaskName);
      console.log('[UpdateTaskStatusHandler] Target status:', targetStatus);

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
        (fullRequestLower.includes('set') && fullRequestLower.includes('todo'));
      
      let finalTargetStatus = targetStatus;
      if (hasExplicitStatusInUtterance && !finalTargetStatus) {
        // Re-detect if we missed it
        if (fullRequestLower.includes('to in progress') || fullRequestLower.includes('to in-progress') ||
            (fullRequestLower.includes('set') && fullRequestLower.includes('in progress'))) {
          finalTargetStatus = 'in progress';
          isExplicitStatus = true;
          console.log('[UpdateTaskStatusHandler] Re-detected explicit "in progress" from utterance');
        } else if (fullRequestLower.includes('to done') || fullRequestLower.includes('to complete') ||
                   (fullRequestLower.includes('set') && fullRequestLower.includes('done'))) {
          finalTargetStatus = 'done';
          isExplicitStatus = true;
          console.log('[UpdateTaskStatusHandler] Re-detected explicit "done" from utterance');
        } else if (fullRequestLower.includes('to to do') || fullRequestLower.includes('to todo') ||
                   (fullRequestLower.includes('set') && (fullRequestLower.includes('to do') || fullRequestLower.includes('todo')))) {
          finalTargetStatus = 'to do';
          isExplicitStatus = true;
          console.log('[UpdateTaskStatusHandler] Re-detected explicit "to do" from utterance');
        }
      }
      
      // Ensure finalTargetStatus is never null at this point
      if (!finalTargetStatus) {
        // Final fallback - should never reach here, but safety check
        console.warn('[UpdateTaskStatusHandler] targetStatus is still null, defaulting to in progress');
        finalTargetStatus = 'in progress';
      }

      console.log('[UpdateTaskStatusHandler] Final status decision:', {
        statusSlot: statusSlot,
        detectedStatus: finalTargetStatus,
        currentStatus: matchingTask.status,
        isExplicitStatus,
        hasExplicitStatusInUtterance,
        willUpdateTo: finalTargetStatus,
        willChangeStatus: finalTargetStatus !== currentStatus
      });
      
      // If explicit status matches current status, log but still update (user's explicit request)
      if (isExplicitStatus && finalTargetStatus === currentStatus) {
        console.log('[UpdateTaskStatusHandler] Explicit status matches current status, updating anyway per user request');
      }

      // Update to the target status
      if (finalTargetStatus === 'done') {
        console.log('[UpdateTaskStatusHandler] Marking task as complete:', {
          taskId: matchingTask.id,
          taskName: matchingTask.name,
          currentStatus: matchingTask.status,
          targetStatus: finalTargetStatus
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
          targetStatus: finalTargetStatus
        });
        
        try {
          await updateTaskStatus(notionClient, matchingTask.id, finalTargetStatus as 'to do' | 'in progress' | 'done');
          
          // Verify the update succeeded by retrieving the page
          try {
            const updatedPage = await notionClient.pages.retrieve({ page_id: matchingTask.id });
            const updatedProps = (updatedPage as any).properties;
            const actualStatus = updatedProps.Status?.select?.name || 'Unknown';
            console.log('[UpdateTaskStatusHandler] Status update verified:', {
              expectedStatus: finalTargetStatus,
              actualStatus: actualStatus,
              match: actualStatus === finalTargetStatus
            });
            
            if (actualStatus !== finalTargetStatus) {
              console.error('[UpdateTaskStatusHandler] Status mismatch! Expected:', finalTargetStatus, 'Got:', actualStatus);
              return buildResponse(
                handlerInput,
                `I tried to update ${matchingTask.name} to ${finalTargetStatus}, but there was an issue. The task status is currently ${actualStatus}.`,
                'What else would you like to do?'
              );
            }
          } catch (verifyError: any) {
            console.warn('[UpdateTaskStatusHandler] Could not verify status update:', verifyError.message);
            // Continue anyway - the update might have succeeded
          }
          
          console.log('[UpdateTaskStatusHandler] Task status updated successfully');
          return buildResponse(
            handlerInput,
            `Updated: ${matchingTask.name} to ${finalTargetStatus}.`,
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

