import { ErrorHandler as AskErrorHandler, HandlerInput } from 'ask-sdk-core';
import { buildSimpleResponse } from '../utils/alexa';
import { getTranslation } from '../utils/i18n';

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
        getTranslation(handlerInput, 'error_generic')
      );
    }

    if (error?.message === 'Invalid license' || error?.message?.includes('license')) {
      console.error('[ErrorHandler] License validation error');
      return buildSimpleResponse(
        handlerInput,
        getTranslation(handlerInput, 'error_license')
      );
    }

    if (error?.message === 'User not found' || error?.message === 'Missing user ID') {
      console.error('[ErrorHandler] User authentication error');
      return buildSimpleResponse(
        handlerInput,
        getTranslation(handlerInput, 'error_auth')
      );
    }

    // Check if this is an unhandled intent (no handler matched)
    if (requestType === 'IntentRequest' && !error) {
      const intentName = (request as any).intent?.name;
      console.error('[ErrorHandler] Unhandled intent:', intentName);
      return buildSimpleResponse(
        handlerInput,
        getTranslation(handlerInput, 'error_unhandled_intent')
      );
    }

    // Generic error response
    console.error('[ErrorHandler] Generic error, returning default message');
    return buildSimpleResponse(
      handlerInput,
      getTranslation(handlerInput, 'error_default')
    );
  }
}

