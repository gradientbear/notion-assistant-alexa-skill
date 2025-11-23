import { RequestHandler, HandlerInput } from 'ask-sdk-core';

export class SessionEndedHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  }

  async handle(handlerInput: HandlerInput) {
    console.log('Session ended:', handlerInput.requestEnvelope.request);
    return handlerInput.responseBuilder.getResponse();
  }
}

