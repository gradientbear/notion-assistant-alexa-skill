import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse } from '../utils/alexa';
import { findDatabaseByName, logEnergy } from '../utils/notion';

export class LogEnergyHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest
      ? (handlerInput.requestEnvelope.request as any).intent?.name
      : null;
    
    const canHandle = isIntentRequest && intentName === 'LogEnergyIntent';
    
    if (isIntentRequest) {
      console.log('[LogEnergyHandler] canHandle check:', {
        isIntentRequest,
        intentName,
        canHandle
      });
    }
    
    return canHandle;
  }

  async handle(handlerInput: HandlerInput) {
    console.log('[LogEnergyHandler] Handler invoked');
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;

    if (!user || !notionClient) {
      return buildResponse(
        handlerInput,
        'To log your energy level, you need to connect your Notion account. ' +
        'Open the Alexa app, go to Skills, find Notion Data, and click Link Account.',
        'What would you like to do?'
      );
    }

    try {
      const request = handlerInput.requestEnvelope.request as any;
      const slots = request.intent.slots || {};
      const energyLevelSlot = slots.energyLevel?.value;
      const energyDateSlot = slots.energyDate?.value;

      console.log('[LogEnergyHandler] Slots:', {
        energyLevel: energyLevelSlot,
        energyDate: energyDateSlot
      });

      if (!energyLevelSlot) {
        return buildResponse(
          handlerInput,
          'What is your energy level from 1 to 10?',
          'Please tell me your energy level from 1 to 10.'
        );
      }

      const energyLogsDbId = await findDatabaseByName(notionClient, 'EnergyLogs');
      if (!energyLogsDbId) {
        return buildResponse(
          handlerInput,
          'I couldn\'t find your EnergyLogs database in Notion. Please make sure it exists and try again.',
          'What would you like to do?'
        );
      }

      // Parse energy level (1-10)
      const energyLevel = parseInt(energyLevelSlot, 10);
      if (isNaN(energyLevel) || energyLevel < 1 || energyLevel > 10) {
        return buildResponse(
          handlerInput,
          'Please provide an energy level between 1 and 10.',
          'What is your energy level from 1 to 10?'
        );
      }

      // Parse date if provided
      let energyDate: string | undefined = undefined;
      if (energyDateSlot) {
        try {
          const date = new Date(energyDateSlot);
          if (!isNaN(date.getTime())) {
            energyDate = date.toISOString().split('T')[0];
          }
        } catch (e) {
          console.warn('[LogEnergyHandler] Could not parse energy date:', energyDateSlot);
        }
      }

      await logEnergy(notionClient, energyLogsDbId, energyLevel, energyDate);

      return buildResponse(
        handlerInput,
        `Logged your energy level as ${energyLevel} out of 10.`,
        'What else would you like to do?'
      );
    } catch (error: any) {
      console.error('[LogEnergyHandler] Error logging energy:', error);
      return buildResponse(
        handlerInput,
        'I encountered an error logging your energy level. Please try again.',
        'What would you like to do?'
      );
    }
  }
}

