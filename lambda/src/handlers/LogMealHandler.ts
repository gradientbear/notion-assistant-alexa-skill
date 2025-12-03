import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse } from '../utils/alexa';
import { findDatabaseByName, addMeal } from '../utils/notion';

export class LogMealHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest
      ? (handlerInput.requestEnvelope.request as any).intent?.name
      : null;
    
    // Handle both LogMealPhraseIntent and LogMealStructuredIntent
    const canHandle = isIntentRequest && (
      intentName === 'LogMealPhraseIntent' || 
      intentName === 'LogMealStructuredIntent'
    );
    
    if (isIntentRequest) {
      console.log('[LogMealHandler] canHandle check:', {
        isIntentRequest,
        intentName,
        canHandle
      });
    }
    
    return canHandle;
  }

  async handle(handlerInput: HandlerInput) {
    console.log('[LogMealHandler] Handler invoked');
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;
    
    if (!user || !notionClient) {
      return buildResponse(
        handlerInput,
        'To log meals, you need to connect your Notion account. ' +
        'Open the Alexa app, go to Skills, find Voice Planner, and click Link Account.',
        'What would you like to do?'
      );
    }

    try {
      const request = handlerInput.requestEnvelope.request as any;
      const slots = request.intent.slots || {};
      // Handle both Phrase (mealName) and Structured (mealNameValue) intents
      const mealNameSlot = slots.mealName?.value || slots.mealNameValue?.value;
      const caloriesSlot = slots.calories?.value;
      const mealDateSlot = slots.mealDate?.value;

      console.log('[LogMealHandler] Slots:', {
        mealName: mealNameSlot,
        calories: caloriesSlot,
        mealDate: mealDateSlot
      });

      if (!mealNameSlot) {
        return buildResponse(
          handlerInput,
          'What was the meal?',
          'Tell me the meal name.'
        );
      }

      const mealsDbId = await findDatabaseByName(notionClient, 'Meals');
      if (!mealsDbId) {
        return buildResponse(
          handlerInput,
          'I couldn\'t find your Meals database in Notion. Please make sure it exists and try again.',
          'What would you like to do?'
        );
      }

      // Parse values
      const mealName = mealNameSlot.trim();
      const calories = caloriesSlot ? parseInt(caloriesSlot, 10) : 0;
      
      let mealDate: string | undefined = undefined;
      if (mealDateSlot) {
        try {
          const date = new Date(mealDateSlot);
          if (!isNaN(date.getTime())) {
            mealDate = date.toISOString().split('T')[0];
          }
        } catch (e) {
          console.warn('[LogMealHandler] Could not parse meal date:', mealDateSlot);
        }
      }

      await addMeal(notionClient, mealsDbId, mealName, calories, mealDate);

      let confirmation = `Logged ${mealName}`;
      if (calories > 0) {
        confirmation += ` with ${calories} calories`;
      }
      confirmation += '.';

      return buildResponse(handlerInput, confirmation, 'What else would you like to do?');
    } catch (error: any) {
      console.error('[LogMealHandler] Error logging meal:', error);
      return buildResponse(
        handlerInput,
        'I encountered an error logging your meal. Please try again.',
        'What would you like to do?'
      );
    }
  }
}

