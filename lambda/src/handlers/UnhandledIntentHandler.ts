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
    const locale = request.locale ?? 'unknown';

    // Log diagnostic info when user utterance didn't match any intent (helps debug locale/language mismatch)
    if (intentName === 'AMAZON.FallbackIntent') {
      const nlu = request.intent?.nlu;
      const tokens = nlu?.tokens ?? [];
      const interpretations = nlu?.interpretations ?? [];
      const utteranceFromTokens = tokens.length ? tokens.join(' ') : '(no tokens)';
      console.log('[UnhandledIntentHandler] AMAZON.FallbackIntent — utterance did not match any custom intent', {
        locale,
        utteranceFromTokens,
        tokenCount: tokens.length,
        interpretationCount: interpretations.length,
        firstInterpretationInput: interpretations[0]?.nluConfidence?.intent?.input ?? '(none)'
      });
    } else {
      console.log('[UnhandledIntentHandler] Unhandled intent', { intentName, locale });
    }

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

