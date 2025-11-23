import { Response, ResponseBuilder } from 'ask-sdk-core';
import { Response as AlexaResponse } from 'ask-sdk-model';

export function buildResponse(speechText: string, repromptText?: string): Response {
  const responseBuilder = new ResponseBuilder()
    .speak(speechText)
    .withShouldEndSession(false);

  if (repromptText) {
    responseBuilder.reprompt(repromptText);
  }

  return responseBuilder.getResponse();
}

export function buildSimpleResponse(speechText: string): Response {
  return new ResponseBuilder()
    .speak(speechText)
    .withShouldEndSession(true)
    .getResponse();
}

export function buildLinkAccountResponse(): Response {
  return new ResponseBuilder()
    .speak('Please link your Notion account in the Alexa app to continue.')
    .withLinkAccountCard()
    .withShouldEndSession(true)
    .getResponse();
}

