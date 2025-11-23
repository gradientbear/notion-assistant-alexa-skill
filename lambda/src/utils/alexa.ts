import { HandlerInput } from 'ask-sdk-core';
import { Response } from 'ask-sdk-model';

export function buildResponse(handlerInput: HandlerInput, speechText: string, repromptText?: string): Response {
  const responseBuilder = handlerInput.responseBuilder;
  responseBuilder
    .speak(speechText)
    .withShouldEndSession(false);

  if (repromptText) {
    responseBuilder.reprompt(repromptText);
  }

  return responseBuilder.getResponse();
}

export function buildSimpleResponse(handlerInput: HandlerInput, speechText: string): Response {
  return handlerInput.responseBuilder
    .speak(speechText)
    .withShouldEndSession(true)
    .getResponse();
}

export function buildLinkAccountResponse(handlerInput: HandlerInput): Response {
  return handlerInput.responseBuilder
    .speak('Please link your Notion account in the Alexa app to continue.')
    .withLinkAccountCard()
    .withShouldEndSession(true)
    .getResponse();
}

