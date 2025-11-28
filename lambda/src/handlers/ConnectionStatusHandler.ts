import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse } from '../utils/alexa';
import { createNotionClient } from '../utils/notion';

export class ConnectionStatusHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const intentName = handlerInput.requestEnvelope.request.type === 'IntentRequest'
      ? (handlerInput.requestEnvelope.request as any).intent?.name
      : null;

    return intentName === 'ConnectionStatusIntent' || 
           intentName === 'CheckConnectionIntent' ||
           intentName === 'AMAZON.HelpIntent' && this.isConnectionCheck(handlerInput);
  }

  private isConnectionCheck(handlerInput: HandlerInput): boolean {
    const request = handlerInput.requestEnvelope.request as any;
    const slots = request.intent?.slots || {};
    const query = slots.query?.value?.toLowerCase() || '';
    return query.includes('connection') || query.includes('status') || query.includes('connect');
  }

  async handle(handlerInput: HandlerInput) {
    try {
      const attributes = handlerInput.attributesManager.getSessionAttributes();
      const user = attributes.user;
      const notionClient = attributes.notionClient;

      console.log('[ConnectionStatusHandler] Checking connection status:', {
        hasUser: !!user,
        hasNotionClient: !!notionClient,
        hasNotionToken: !!user?.notion_token
      });

      if (!user || !user.notion_token) {
        return buildResponse(
          handlerInput,
          'Notion is not connected. To connect, open the Alexa app, go to Skills, ' +
          'find Notion Data, and click Link Account. Once connected, I can help you manage your tasks.',
          'What would you like to do?'
        );
      }

      // Test the connection by making a simple API call
      try {
        if (!notionClient) {
          // Create client if not in session
          const client = createNotionClient(user.notion_token);
          // Test with a simple search
          await client.search({ page_size: 1 });
        } else {
          await notionClient.search({ page_size: 1 });
        }

        return buildResponse(
          handlerInput,
          'Your Notion connection is working perfectly! I can access your Notion workspace and help you manage your tasks. ' +
          'What would you like to do?',
          'What would you like to do?'
        );
      } catch (error: any) {
        console.error('[ConnectionStatusHandler] Connection test failed:', error);
        
        if (error.code === 'unauthorized' || error.status === 401) {
          return buildResponse(
            handlerInput,
            'There seems to be an issue with your Notion connection. Your token may have expired. ' +
            'Please reconnect your Notion account in the Alexa app. Go to Skills, find Notion Data, and click Link Account again.',
            'What would you like to do?'
          );
        }

        return buildResponse(
          handlerInput,
          'I\'m having trouble connecting to your Notion workspace. Please try again in a moment, ' +
          'or reconnect your account in the Alexa app if the problem persists.',
          'What would you like to do?'
        );
      }
    } catch (error: any) {
      console.error('[ConnectionStatusHandler] Error:', error);
      return buildResponse(
        handlerInput,
        'Sorry, I encountered an error while checking your connection. Please try again.',
        'What would you like to do?'
      );
    }
  }
}

