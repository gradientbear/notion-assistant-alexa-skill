import { ErrorHandler, HandlerInput, ErrorHandlerInput } from 'ask-sdk-core';
import { buildSimpleResponse } from '../utils/alexa';

export class ErrorHandler implements ErrorHandler {
  canHandle(handlerInput: ErrorHandlerInput): boolean {
    return true;
  }

  async handle(handlerInput: ErrorHandlerInput) {
    const error = handlerInput.error;
    console.error('Error handled:', error);

    // Handle specific error types
    if (error.name === 'AskSdk.RequestEnvelopeError') {
      return buildSimpleResponse(
        'I encountered an error processing your request. Please try again.'
      );
    }

    if (error.message === 'Invalid license') {
      return buildSimpleResponse(
        'Your license key is invalid. Please contact support.'
      );
    }

    // Generic error response
    return buildSimpleResponse(
      'Sorry, I encountered an error. Please try again later.'
    );
  }
}

