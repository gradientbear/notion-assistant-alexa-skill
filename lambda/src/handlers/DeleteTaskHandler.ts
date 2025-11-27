import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse } from '../utils/alexa';
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
    return (
      handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      handlerInput.requestEnvelope.request.intent.name === 'DeleteTaskIntent'
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

