import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse } from '../utils/alexa';
import { findDatabaseByName, addWorkout } from '../utils/notion';

export class AddWorkoutHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest
      ? (handlerInput.requestEnvelope.request as any).intent?.name
      : null;
    
    const canHandle = isIntentRequest && intentName === 'AddWorkoutIntent';
    
    if (isIntentRequest) {
      console.log('[AddWorkoutHandler] canHandle check:', {
        isIntentRequest,
        intentName,
        canHandle
      });
    }
    
    return canHandle;
  }

  async handle(handlerInput: HandlerInput) {
    console.log('[AddWorkoutHandler] Handler invoked');
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;
    
    if (!user || !notionClient) {
      return buildResponse(
        handlerInput,
        'To log workouts, you need to connect your Notion account. ' +
        'Open the Alexa app, go to Skills, find Notion Data, and click Link Account.',
        'What would you like to do?'
      );
    }

    try {
      const request = handlerInput.requestEnvelope.request as any;
      const slots = request.intent.slots || {};
      const workoutTypeSlot = slots.workoutType?.value;
      const durationSlot = slots.duration?.value;
      const workoutDateSlot = slots.workoutDate?.value;
      const caloriesBurnedSlot = slots.caloriesBurned?.value;

      console.log('[AddWorkoutHandler] Slots:', {
        workoutType: workoutTypeSlot,
        duration: durationSlot,
        workoutDate: workoutDateSlot,
        caloriesBurned: caloriesBurnedSlot
      });

      if (!workoutTypeSlot) {
        return buildResponse(
          handlerInput,
          'What workout did you do?',
          'Tell me the workout type.'
        );
      }

      const workoutsDbId = await findDatabaseByName(notionClient, 'Workouts');
      if (!workoutsDbId) {
        return buildResponse(
          handlerInput,
          'I couldn\'t find your Workouts database in Notion. Please make sure it exists and try again.',
          'What would you like to do?'
        );
      }

      // Parse values
      const workoutType = workoutTypeSlot.trim();
      const duration = durationSlot ? parseInt(durationSlot, 10) : undefined;
      const caloriesBurned = caloriesBurnedSlot ? parseInt(caloriesBurnedSlot, 10) : undefined;
      
      let workoutDate: string | undefined = undefined;
      if (workoutDateSlot) {
        try {
          const date = new Date(workoutDateSlot);
          if (!isNaN(date.getTime())) {
            workoutDate = date.toISOString().split('T')[0];
          }
        } catch (e) {
          console.warn('[AddWorkoutHandler] Could not parse workout date:', workoutDateSlot);
        }
      }

      await addWorkout(notionClient, workoutsDbId, workoutType, duration, caloriesBurned, workoutDate);

      let confirmation = `Logged ${workoutType}`;
      if (duration) {
        confirmation += ` for ${duration} minutes`;
      }
      if (caloriesBurned) {
        confirmation += `, ${caloriesBurned} calories burned`;
      }
      confirmation += '.';

      return buildResponse(handlerInput, confirmation, 'What else would you like to do?');
    } catch (error: any) {
      console.error('[AddWorkoutHandler] Error logging workout:', error);
      return buildResponse(
        handlerInput,
        'I encountered an error logging your workout. Please try again.',
        'What would you like to do?'
      );
    }
  }
}

