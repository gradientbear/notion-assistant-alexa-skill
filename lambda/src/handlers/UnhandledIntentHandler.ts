import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse } from '../utils/alexa';
import { getTranslation } from '../utils/i18n';

/**
 * Handles intents that don't match any specific handler.
 * Provides helpful guidance to users about available commands.
 */
export class UnhandledIntentHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    // This handler should be added last, so it only handles intents that no other handler can handle
    // The SDK will call this if no other handler's canHandle returns true
    return handlerInput.requestEnvelope.request.type === 'IntentRequest';
  }

  async handle(handlerInput: HandlerInput) {
    const request = handlerInput.requestEnvelope.request as any;
    const intentName = request.intent?.name;
    
    // Check if this is a built-in Amazon intent
    if (intentName?.startsWith('AMAZON.')) {
      // Handle common Amazon intents
      if (intentName === 'AMAZON.HelpIntent') {
        return buildResponse(
          handlerInput,
          getTranslation(handlerInput, 'help'),
          getTranslation(handlerInput, 'what_would_you_like')
        );
      }
      
      if (intentName === 'AMAZON.StopIntent' || intentName === 'AMAZON.CancelIntent') {
        return handlerInput.responseBuilder
          .speak(getTranslation(handlerInput, 'goodbye'))
          .withShouldEndSession(true)
          .getResponse();
      }
    }
    
    // For other unhandled intents, provide helpful guidance
    return buildResponse(
      handlerInput,
      getTranslation(handlerInput, 'unhandled'),
      getTranslation(handlerInput, 'what_would_you_like')
    );
  }
}

