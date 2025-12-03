import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse } from '../utils/alexa';
import { findDatabaseByName, getMeals } from '../utils/notion';

export class GetCaloriesHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest
      ? (handlerInput.requestEnvelope.request as any).intent?.name
      : null;
    
    const canHandle = isIntentRequest && intentName === 'GetCaloriesIntent';
    
    if (isIntentRequest) {
      console.log('[GetCaloriesHandler] canHandle check:', {
        isIntentRequest,
        intentName,
        canHandle
      });
    }
    
    return canHandle;
  }

  async handle(handlerInput: HandlerInput) {
    console.log('[GetCaloriesHandler] Handler invoked');
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;
    
    if (!user || !notionClient) {
      return buildResponse(
        handlerInput,
        'To view your calories, you need to connect your Notion account. ' +
        'Open the Alexa app, go to Skills, find Voice Planner, and click Link Account.',
        'What would you like to do?'
      );
    }

    try {
      const mealsDbId = await findDatabaseByName(notionClient, 'Meals');
      if (!mealsDbId) {
        return buildResponse(
          handlerInput,
          'I couldn\'t find your Meals database in Notion. Please make sure it exists and try again.',
          'What would you like to do?'
        );
      }

      // Get meals from today
      const today = new Date().toISOString().split('T')[0];
      const todayMeals = await getMeals(notionClient, mealsDbId, today);

      if (todayMeals.length === 0) {
        return buildResponse(
          handlerInput,
          'You haven\'t logged any meals today.',
          'What else would you like to do?'
        );
      }

      const totalCalories = todayMeals.reduce((sum, meal) => sum + (meal.calories || 0), 0);
      
      let speechText = `You've logged ${todayMeals.length} meal${todayMeals.length > 1 ? 's' : ''} today with a total of ${totalCalories} calories. `;
      
      if (todayMeals.length <= 3) {
        // List meals if 3 or fewer
        speechText += 'Your meals: ';
        todayMeals.forEach((meal, index) => {
          speechText += `${meal.meal}`;
          if (meal.calories > 0) {
            speechText += ` with ${meal.calories} calories`;
          }
          if (index < todayMeals.length - 1) {
            speechText += ', ';
          }
        });
        speechText += '.';
      } else {
        // Just mention total if more than 3 meals
        speechText += 'That\'s great progress!';
      }

      return buildResponse(handlerInput, speechText, 'What else would you like to do?');
    } catch (error: any) {
      console.error('[GetCaloriesHandler] Error getting calories:', error);
      return buildResponse(
        handlerInput,
        'I encountered an error retrieving your calorie information. Please try again.',
        'What would you like to do?'
      );
    }
  }
}

