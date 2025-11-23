import { ErrorHandler as AskErrorHandler, HandlerInput } from 'ask-sdk-core';
import { buildSimpleResponse } from '../utils/alexa';

export class ErrorHandler implements AskErrorHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    return true;
  }

  async handle(handlerInput: HandlerInput) {
    const error = (handlerInput as any).error;
    console.error('Error handled:', error);

    // Handle specific error types
    if (error.name === 'AskSdk.RequestEnvelopeError') {
      return buildSimpleResponse(
        handlerInput,
        'I encountered an error processing your request. Please try again.'
      );
    }

    if (error.message === 'Invalid license') {
      return buildSimpleResponse(
        handlerInput,
        'Your license key is invalid. Please contact support.'
      );
    }

    // Generic error response
    return buildSimpleResponse(
      handlerInput,
      'Sorry, I encountered an error. Please try again later.'
    );
  }
}

