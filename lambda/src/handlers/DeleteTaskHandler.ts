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
    // Handle both DeleteTaskPhraseIntent and DeleteTaskStructuredIntent
    const canHandle = isIntentRequest && (
      intentName === 'DeleteTaskPhraseIntent' || 
      intentName === 'DeleteTaskStructuredIntent'
    );
    
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
        'Open the Alexa app, go to Skills, find Voice Planner, and click Link Account. ' +
        'Once connected, you can delete tasks from your Notion workspace.',
        'What would you like to do?'
      );
    }

    try {
      const request = handlerInput.requestEnvelope.request as any;
      // Handle both Phrase (taskName) and Structured (taskNameValue) intents, also check for 'task' slot
      const taskSlot = request.intent.slots?.task?.value || 
                       request.intent.slots?.taskName?.value || 
                       request.intent.slots?.taskNameValue?.value;

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

