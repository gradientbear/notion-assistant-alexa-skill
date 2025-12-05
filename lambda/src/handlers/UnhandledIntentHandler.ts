import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse } from '../utils/alexa';

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
    console.log('[UnhandledIntentHandler] Handler invoked');
    const request = handlerInput.requestEnvelope.request as any;
    const intentName = request.intent?.name;
    
    console.log('[UnhandledIntentHandler] Intent name:', intentName);
    
    // Check if this is a built-in Amazon intent
    if (intentName?.startsWith('AMAZON.')) {
      // Handle common Amazon intents
      if (intentName === 'AMAZON.HelpIntent') {
        return buildResponse(
          handlerInput,
          'I can help you manage your tasks in Notion. ' +
          'You can add tasks, query your tasks, update tasks, or delete them. ' +
          'For example, say "add finish the report tomorrow at 5pm" or "what are my tasks for today". ' +
          'What would you like to do?',
          'What would you like to do?'
        );
      }
      
      if (intentName === 'AMAZON.StopIntent' || intentName === 'AMAZON.CancelIntent') {
        return handlerInput.responseBuilder
          .speak('Goodbye!')
          .withShouldEndSession(true)
          .getResponse();
      }
    }
    
    // For other unhandled intents, provide helpful guidance
    const availableCommands = [
      'add a task',
      'query your tasks',
      'update a task',
      'delete a task'
    ];
    
    return buildResponse(
      handlerInput,
      `I'm not sure how to help with that. I can help you manage your tasks in Notion. ` +
      `You can ${availableCommands.join(', ')}, or say "help" to learn more. ` +
      `What would you like to do?`,
      'What would you like to do?'
    );
  }
}

