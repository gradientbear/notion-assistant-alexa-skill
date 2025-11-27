import { RequestInterceptor, HandlerInput } from 'ask-sdk-core';
import { getUserByAmazonId } from '../utils/database';
import { createNotionClient } from '../utils/notion';

export class NotionConnectionInterceptor implements RequestInterceptor {
  async process(handlerInput: HandlerInput): Promise<void> {
    try {
      const requestType = handlerInput.requestEnvelope.request.type;

      console.log('[NotionConnectionInterceptor] Processing request type:', requestType);

    // Skip for LaunchRequest and SessionEndedRequest
    if (requestType === 'LaunchRequest' || requestType === 'SessionEndedRequest') {
      console.log('[NotionConnectionInterceptor] Skipping for', requestType);
      return;
    }

    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;

    console.log('[NotionConnectionInterceptor] User check:', {
      hasUser: !!user,
      hasNotionToken: !!user?.notion_token,
      tokenLength: user?.notion_token?.length || 0
    });

    if (!user || !user.notion_token) {
      console.log('[NotionConnectionInterceptor] Missing user or notion_token');
      // This will be handled by individual handlers
      return;
    }

    // Create Notion client and store in session
    console.log('[NotionConnectionInterceptor] Creating Notion client...');
    const notionClient = createNotionClient(user.notion_token);
    attributes.notionClient = notionClient;
    handlerInput.attributesManager.setSessionAttributes(attributes);
    console.log('[NotionConnectionInterceptor] Notion client created and stored');
    } catch (error: any) {
      console.error('[NotionConnectionInterceptor] Error:', error);
      console.error('[NotionConnectionInterceptor] Error stack:', error?.stack);
      // Don't throw - let handlers deal with missing client
    }
  }
}

