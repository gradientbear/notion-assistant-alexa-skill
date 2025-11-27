import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse } from '../utils/alexa';
import { findDatabaseByName, getAllTasks } from '../utils/notion';
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

export class UpdateTaskStatusHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    return (
      handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      handlerInput.requestEnvelope.request.intent.name === 'UpdateTaskStatusIntent'
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

      // Update status to "In Progress"
      await updateTaskStatus(notionClient, matchingTask.id, 'In Progress');

      return buildResponse(
        handlerInput,
        `Updated: ${matchingTask.name} to in progress.`,
        'What else would you like to do?'
      );
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

