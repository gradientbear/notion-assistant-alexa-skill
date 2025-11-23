import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { IntentRequest } from 'ask-sdk-model';
import { buildResponse, buildSimpleResponse } from '../utils/alexa';
import { findDatabaseByName, logEnergy, mapEnergyLevel, getTimeOfDay } from '../utils/notion';

export class EnergyTrackerHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    return (
      handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      handlerInput.requestEnvelope.request.intent.name === 'EnergyTrackerIntent'
    );
  }

  async handle(handlerInput: HandlerInput) {
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;

    if (!user || !notionClient) {
      return buildSimpleResponse(
        handlerInput,
        'Please link your Notion account in the Alexa app to use this feature.'
      );
    }

    const request = handlerInput.requestEnvelope.request as IntentRequest;
    const energySlot = request.intent.slots?.energyLevel;

    let energyValue: number;

    if (energySlot && energySlot.value) {
      // Try to parse the energy level
      const parsed = parseInt(energySlot.value, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) {
        energyValue = parsed;
      } else {
        return buildResponse(
          handlerInput,
          'Please provide an energy level between 1 and 10.',
          'What is your energy level from 1 to 10?'
        );
      }
    } else {
      // Ask for energy level
      return buildResponse(
        handlerInput,
        'What is your energy level from 1 to 10?',
        'Please tell me your energy level from 1 to 10.'
      );
    }

    try {
      const energyLogsDbId = await findDatabaseByName(notionClient, 'Energy_Logs');
      if (!energyLogsDbId) {
        return buildSimpleResponse(
          handlerInput,
          'I couldn\'t find your Energy Logs database in Notion. ' +
          'Please make sure it exists and try again.'
        );
      }

      const energyLevel = mapEnergyLevel(energyValue);
      const timeOfDay = getTimeOfDay();

      await logEnergy(notionClient, energyLogsDbId, energyLevel, timeOfDay);

      return buildSimpleResponse(
        handlerInput,
        `Logged your energy level as ${energyLevel.toLowerCase()} for ${timeOfDay.toLowerCase()}.`
      );
    } catch (error) {
      console.error('Error logging energy:', error);
      return buildSimpleResponse(
        handlerInput,
        'I encountered an error logging your energy level. Please try again later.'
      );
    }
  }
}

