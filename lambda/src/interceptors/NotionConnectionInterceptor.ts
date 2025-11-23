import { RequestInterceptor, HandlerInput } from 'ask-sdk-core';
import { getUserByAmazonId } from '../utils/database';
import { createNotionClient } from '../utils/notion';

export class NotionConnectionInterceptor implements RequestInterceptor {
  async process(handlerInput: HandlerInput): Promise<void> {
    const requestType = handlerInput.requestEnvelope.request.type;

    // Skip for LaunchRequest and SessionEndedRequest
    if (requestType === 'LaunchRequest' || requestType === 'SessionEndedRequest') {
      return;
    }

    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;

    if (!user || !user.notion_token) {
      // This will be handled by individual handlers
      return;
    }

    // Create Notion client and store in session
    const notionClient = createNotionClient(user.notion_token);
    attributes.notionClient = notionClient;
    handlerInput.attributesManager.setSessionAttributes(attributes);
  }
}

