import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse } from '../utils/alexa';
import { findDatabaseByName, getWorkouts } from '../utils/notion';

export class GetWorkoutsHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest
      ? (handlerInput.requestEnvelope.request as any).intent?.name
      : null;
    
    const canHandle = isIntentRequest && intentName === 'GetWorkoutsIntent';
    
    if (isIntentRequest) {
      console.log('[GetWorkoutsHandler] canHandle check:', {
        isIntentRequest,
        intentName,
        canHandle
      });
    }
    
    return canHandle;
  }

  async handle(handlerInput: HandlerInput) {
    console.log('[GetWorkoutsHandler] Handler invoked');
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;
    
    if (!user || !notionClient) {
      return buildResponse(
        handlerInput,
        'To view your workouts, you need to connect your Notion account. ' +
        'Open the Alexa app, go to Skills, find Voice Planner, and click Link Account.',
        'What would you like to do?'
      );
    }

    try {
      const workoutsDbId = await findDatabaseByName(notionClient, 'Workouts');
      if (!workoutsDbId) {
        return buildResponse(
          handlerInput,
          'I couldn\'t find your Workouts database in Notion. Please make sure it exists and try again.',
          'What would you like to do?'
        );
      }

      // Get workouts from this week
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
      weekStart.setHours(0, 0, 0, 0);
      
      const weekStartStr = weekStart.toISOString().split('T')[0];
      const allWorkouts = await getWorkouts(notionClient, workoutsDbId);
      
      // Filter workouts from this week
      const thisWeekWorkouts = allWorkouts.filter(workout => {
        if (!workout.date) return false;
        const workoutDate = new Date(workout.date);
        return workoutDate >= weekStart;
      });

      if (thisWeekWorkouts.length === 0) {
        return buildResponse(
          handlerInput,
          'You haven\'t logged any workouts this week.',
          'What else would you like to do?'
        );
      }

      let speechText = `You've logged ${thisWeekWorkouts.length} workout${thisWeekWorkouts.length > 1 ? 's' : ''} this week: `;
      
      thisWeekWorkouts.forEach((workout, index) => {
        speechText += workout.workout;
        if (workout.duration) {
          speechText += ` for ${workout.duration} minutes`;
        }
        if (workout.caloriesBurned) {
          speechText += `, burning ${workout.caloriesBurned} calories`;
        }
        if (index < thisWeekWorkouts.length - 1) {
          speechText += ', ';
        }
      });
      speechText += '.';

      return buildResponse(handlerInput, speechText, 'What else would you like to do?');
    } catch (error: any) {
      console.error('[GetWorkoutsHandler] Error getting workouts:', error);
      return buildResponse(
        handlerInput,
        'I encountered an error retrieving your workouts. Please try again.',
        'What would you like to do?'
      );
    }
  }
}

