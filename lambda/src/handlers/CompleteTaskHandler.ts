import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse, cleanTaskName, findMatchingTask } from '../utils/alexa';
import {
  findDatabaseByName,
  getAllTasks,
  getTasksByDate,
  markTaskComplete,
  markTasksCompleteBatch,
} from '../utils/notion';

export class CompleteTaskHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest 
      ? (handlerInput.requestEnvelope.request as any).intent?.name 
      : null;
    // Handle both CompleteTaskPhraseIntent and CompleteTaskStructuredIntent
    const canHandle = isIntentRequest && (
      intentName === 'CompleteTaskPhraseIntent' || 
      intentName === 'CompleteTaskStructuredIntent'
    );
    
    if (isIntentRequest) {
      console.log('[CompleteTaskHandler] canHandle check:', {
        isIntentRequest,
        intentName,
        canHandle
      });
    }
    
    return canHandle;
  }

  async handle(handlerInput: HandlerInput) {
    console.log('[CompleteTaskHandler] ========== HANDLER INVOKED ==========');
    
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;
    
    console.log('[CompleteTaskHandler] Session check:', {
      hasUser: !!user,
      hasNotionClient: !!notionClient,
      userId: user?.id
    });

    if (!user || !notionClient) {
      return buildResponse(
        handlerInput,
        'To mark tasks as complete, you need to connect your Notion account. ' +
        'Open the Alexa app, go to Skills, find Voice Planner, and click Link Account. ' +
        'Once connected, you can manage your tasks.',
        'What would you like to do?'
      );
    }

    try {
      const request = handlerInput.requestEnvelope.request as any;
      // Handle both Phrase (taskName) and Structured (taskNameValue) intents
      const taskNameSlot = request.intent.slots?.taskName?.value || request.intent.slots?.taskNameValue?.value;
      
      console.log('[CompleteTaskHandler] Slots:', {
        taskName: taskNameSlot
      });

      const tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
      if (!tasksDbId) {
        return buildResponse(
          handlerInput,
          'I couldn\'t find your Tasks database in Notion. Please make sure it exists and try again.',
          'What would you like to do?'
        );
      }

      // Check for batch operations
      const taskValue = taskNameSlot?.toLowerCase() || '';
      
      if (taskValue.includes('all') && (taskValue.includes('today') || taskValue.includes("today's"))) {
        // Mark all today's tasks as complete
        const today = new Date().toISOString().split('T')[0];
        const tasks = await getTasksByDate(notionClient, tasksDbId, today);
        
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
      if (!taskNameSlot || taskNameSlot.trim().length === 0) {
        return buildResponse(
          handlerInput,
          'Which task would you like to mark as complete?',
          'Tell me the task name.'
        );
      }

      // Clean up the task name by removing command words
      const cleanedTaskName = cleanTaskName(taskNameSlot);
      
      console.log('[CompleteTaskHandler] Original task slot:', taskNameSlot);
      console.log('[CompleteTaskHandler] Cleaned task name:', cleanedTaskName);

      console.log('[CompleteTaskHandler] Searching for task:', cleanedTaskName);
      
      const allTasks = await getAllTasks(notionClient, tasksDbId);
      console.log('[CompleteTaskHandler] Found tasks:', allTasks.length);
      console.log('[CompleteTaskHandler] Task names:', allTasks.map(t => t.name));
      console.log('[CompleteTaskHandler] Task statuses:', allTasks.map(t => ({ name: t.name, status: t.status })));

      // Hybrid matching: exact -> word token -> substring
      const matchingTask = findMatchingTask(cleanedTaskName, allTasks);

      console.log('[CompleteTaskHandler] Matching task:', matchingTask ? { name: matchingTask.name, id: matchingTask.id, status: matchingTask.status } : 'none found');

      if (!matchingTask) {
        console.log('[CompleteTaskHandler] No matching task found');
        return buildResponse(
          handlerInput,
          `I couldn't find "${cleanedTaskName}" in your tasks. Please try saying the full task name.`,
          'What else would you like to do?'
        );
      }

      console.log('[CompleteTaskHandler] Calling markTaskComplete for task:', {
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
          console.log('[CompleteTaskHandler] Status update verified:', {
            expectedStatus: 'done',
            actualStatus: actualStatus,
            match: actualStatus === 'done'
          });
          
          if (actualStatus !== 'done') {
            console.error('[CompleteTaskHandler] Status mismatch! Expected: done, Got:', actualStatus);
            return buildResponse(
              handlerInput,
              `I tried to mark ${matchingTask.name} as complete, but there was an issue. The task status is currently ${actualStatus}.`,
              'What else would you like to do?'
            );
          }
        } catch (verifyError: any) {
          console.warn('[CompleteTaskHandler] Could not verify status update:', verifyError.message);
          // Continue anyway - the update might have succeeded
        }
        
        console.log('[CompleteTaskHandler] Task marked as complete successfully');
        return buildResponse(
          handlerInput,
          `Marked: ${matchingTask.name} as complete.`,
          'What else would you like to do?'
        );
      } catch (markError: any) {
        console.error('[CompleteTaskHandler] Error in markTaskComplete call:', {
          message: markError?.message,
          status: markError?.status,
          code: markError?.code,
          stack: markError?.stack
        });
        throw markError; // Re-throw to be caught by outer catch
      }
    } catch (error: any) {
      console.error('[CompleteTaskHandler] Error marking task complete:', error);
      console.error('[CompleteTaskHandler] Error details:', {
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

