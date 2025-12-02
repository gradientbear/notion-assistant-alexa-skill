import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse } from '../utils/alexa';
import { findDatabaseByName, getCompletedCount } from '../utils/notion';

export class CompletedCountHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest
      ? (handlerInput.requestEnvelope.request as any).intent?.name
      : null;
    
    const canHandle = isIntentRequest && intentName === 'CompletedCountIntent';
    
    return canHandle;
  }

  async handle(handlerInput: HandlerInput) {
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;

    if (!user || !notionClient) {
      return buildResponse(
        handlerInput,
        'To check your completed tasks, you need to connect your Notion account.',
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

      const count = await getCompletedCount(notionClient, tasksDbId);
      
      return buildResponse(
        handlerInput,
        `You have completed ${count} task${count !== 1 ? 's' : ''}.`,
        'What else would you like to do?'
      );
    } catch (error: any) {
      console.error('[CompletedCountHandler] Error:', error);
      return buildResponse(
        handlerInput,
        'I encountered an error counting your completed tasks. Please try again.',
        'What would you like to do?'
      );
    }
  }
}

