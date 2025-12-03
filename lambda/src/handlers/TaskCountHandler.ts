import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse } from '../utils/alexa';
import { findDatabaseByName, getTaskCount } from '../utils/notion';

export class TaskCountHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest
      ? (handlerInput.requestEnvelope.request as any).intent?.name
      : null;
    
    const canHandle = isIntentRequest && intentName === 'TaskCountIntent';
    
    return canHandle;
  }

  async handle(handlerInput: HandlerInput) {
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;

    if (!user || !notionClient) {
      return buildResponse(
        handlerInput,
        'To check your task count, you need to connect your Notion account.',
        'What would you like to do?'
      );
    }

    try {
      const tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
      if (!tasksDbId) {
        return buildResponse(
          handlerInput,
          'I couldn\'t find your Tasks database in Notion.',
          'What would you like to do?'
        );
      }

      const count = await getTaskCount(notionClient, tasksDbId);
      
      return buildResponse(
        handlerInput,
        `You have ${count} task${count !== 1 ? 's' : ''}.`,
        'What else would you like to do?'
      );
    } catch (error: any) {
      console.error('[TaskCountHandler] Error:', error);
      return buildResponse(
        handlerInput,
        'I encountered an error counting your tasks. Please try again.',
        'What would you like to do?'
      );
    }
  }
}

