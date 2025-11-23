import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildSimpleResponse } from '../utils/alexa';
import { findDatabaseByName, logFocusSession } from '../utils/notion';

const FOCUS_DURATION_MINUTES = 25;

export class FocusTimerHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    return (
      handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      handlerInput.requestEnvelope.request.intent.name === 'FocusTimerIntent'
    );
  }

  async handle(handlerInput: HandlerInput) {
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;

    if (!user || !notionClient) {
      return buildSimpleResponse(
        'Please link your Notion account in the Alexa app to use this feature.'
      );
    }

    try {
      const focusLogsDbId = await findDatabaseByName(notionClient, 'Focus_Logs');
      if (!focusLogsDbId) {
        return buildSimpleResponse(
          'I couldn\'t find your Focus Logs database in Notion. ' +
          'Please make sure it exists and try again.'
        );
      }

      // Log the focus session start
      await logFocusSession(notionClient, focusLogsDbId, FOCUS_DURATION_MINUTES, 'Medium');

      // Start timer (Alexa will handle the timer, but we log it immediately)
      return buildSimpleResponse(
        `Starting your ${FOCUS_DURATION_MINUTES}-minute focus timer. ` +
        `I've logged this session to your Notion Focus Logs. ` +
        `Focus time starts now!`
      );
    } catch (error) {
      console.error('Error starting focus timer:', error);
      return buildSimpleResponse(
        'I encountered an error starting your focus timer. Please try again later.'
      );
    }
  }
}

