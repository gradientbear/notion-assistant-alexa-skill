import { ErrorHandler as AskErrorHandler, HandlerInput } from 'ask-sdk-core';
import { buildSimpleResponse } from '../utils/alexa';

export class ErrorHandler implements AskErrorHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    return true;
  }

  async handle(handlerInput: HandlerInput) {
    const error = (handlerInput as any).error;
    const request = handlerInput.requestEnvelope.request;
    const requestType = request.type;
    
    console.error('[ErrorHandler] Error caught:', {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
      requestType,
      intentName: requestType === 'IntentRequest' ? (request as any).intent?.name : null,
      error: JSON.stringify(error)
    });

    // Handle specific error types
    if (error?.name === 'AskSdk.RequestEnvelopeError') {
      console.error('[ErrorHandler] Request envelope error');
      return buildSimpleResponse(
        handlerInput,
        'I encountered an error processing your request. Please try again.'
      );
    }

    if (error?.message === 'Invalid license' || error?.message?.includes('license')) {
      console.error('[ErrorHandler] License validation error');
      return buildSimpleResponse(
        handlerInput,
        'Your license key is invalid. Please contact support.'
      );
    }

    if (error?.message === 'User not found' || error?.message === 'Missing user ID') {
      console.error('[ErrorHandler] User authentication error');
      return buildSimpleResponse(
        handlerInput,
        'Please link your account in the Alexa app to use this skill.'
      );
    }

    // Check if this is an unhandled intent (no handler matched)
    if (requestType === 'IntentRequest' && !error) {
      const intentName = (request as any).intent?.name;
      console.error('[ErrorHandler] Unhandled intent:', intentName);
      return buildSimpleResponse(
        handlerInput,
        'I\'m not sure how to help with that. ' +
        'You can add tasks, list tasks, mark them complete, update them, or delete them. ' +
        'What would you like to do?'
      );
    }

    // Generic error response
    console.error('[ErrorHandler] Generic error, returning default message');
    return buildSimpleResponse(
      handlerInput,
      'Sorry, I encountered an error. Please try again later.'
    );
  }
}

