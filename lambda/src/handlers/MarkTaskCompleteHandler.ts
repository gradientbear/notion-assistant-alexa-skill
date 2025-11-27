import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse } from '../utils/alexa';
import {
  findDatabaseByName,
  getAllTasks,
  getTasksByDateRange,
  markTaskComplete,
  markTasksCompleteBatch,
} from '../utils/notion';

export class MarkTaskCompleteHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    return (
      handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      handlerInput.requestEnvelope.request.intent.name === 'MarkTaskCompleteIntent'
    );
  }

  async handle(handlerInput: HandlerInput) {
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;

    if (!user || !notionClient) {
      return buildResponse(
        handlerInput,
        'Please link your Notion account in the Alexa app to use this feature.',
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

      const taskName = taskSlot.toLowerCase();
      const allTasks = await getAllTasks(notionClient, tasksDbId);

      // Fuzzy matching
      const matchingTask = allTasks.find(
        task => task.name.toLowerCase().includes(taskName) ||
                taskName.includes(task.name.toLowerCase())
      );

      if (!matchingTask) {
        return buildResponse(
          handlerInput,
          `I couldn't find "${taskSlot}" in your tasks.`,
          'What else would you like to do?'
        );
      }

      await markTaskComplete(notionClient, matchingTask.id);

      return buildResponse(
        handlerInput,
        `Marked: ${matchingTask.name} as complete.`,
        'What else would you like to do?'
      );
    } catch (error) {
      console.error('Error marking task complete:', error);
      return buildResponse(
        handlerInput,
        'I encountered an error marking your task as complete. Please try again.',
        'What would you like to do?'
      );
    }
  }
}

