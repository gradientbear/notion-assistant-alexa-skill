import { ErrorHandler as AskErrorHandler, HandlerInput } from 'ask-sdk-core';
import { buildSimpleResponse } from '../utils/alexa';

export class ErrorHandler implements AskErrorHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    return true;
  }

  async handle(handlerInput: HandlerInput) {
    const error = (handlerInput as any).error;
    console.error('[ErrorHandler] Error caught:', {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
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

    // Generic error response
    console.error('[ErrorHandler] Generic error, returning default message');
    return buildSimpleResponse(
      handlerInput,
      'Sorry, I encountered an error. Please try again later.'
    );
  }
}

