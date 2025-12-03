import { SkillBuilders } from 'ask-sdk-core';
import { LaunchRequestHandler } from './handlers/LaunchRequestHandler';
import { GetTasksHandler } from './handlers/GetTasksHandler';
import { GetTasksByDateHandler } from './handlers/GetTasksByDateHandler';
import { AddTaskHandler } from './handlers/AddTaskHandler';
import { CompleteTaskHandler } from './handlers/CompleteTaskHandler';
import { UpdateTaskStatusHandler } from './handlers/UpdateTaskStatusHandler';
import { DeleteTaskHandler } from './handlers/DeleteTaskHandler';
import { AddWorkoutHandler } from './handlers/AddWorkoutHandler';
import { GetWorkoutsHandler } from './handlers/GetWorkoutsHandler';
import { LogMealHandler } from './handlers/LogMealHandler';
import { GetCaloriesHandler } from './handlers/GetCaloriesHandler';
import { AddNoteHandler } from './handlers/AddNoteHandler';
import { ReadNotesHandler } from './handlers/ReadNotesHandler';
import { LogEnergyHandler } from './handlers/LogEnergyHandler';
import { TaskCountHandler } from './handlers/TaskCountHandler';
import { CompletedCountHandler } from './handlers/CompletedCountHandler';
import { SummaryHandler } from './handlers/SummaryHandler';
import { NextDeadlineHandler } from './handlers/NextDeadlineHandler';
import { ShoppingListHandler } from './handlers/ShoppingListHandler';
import { ConnectionStatusHandler } from './handlers/ConnectionStatusHandler';
import { UnhandledIntentHandler } from './handlers/UnhandledIntentHandler';
import { SessionEndedHandler } from './handlers/SessionEndedHandler';
import { ErrorHandler } from './handlers/ErrorHandler';

import { AuthInterceptor, handleAuthError } from './middleware/auth';
import { NotionConnectionInterceptor } from './interceptors/NotionConnectionInterceptor';

// ======================================================================
// BUILD SKILL
// ======================================================================

const skill = SkillBuilders.custom()
  .addRequestHandlers(
    new LaunchRequestHandler(),
    // Task handlers
    new GetTasksHandler(),
    new GetTasksByDateHandler(),
    new AddTaskHandler(),
    new CompleteTaskHandler(),
    new UpdateTaskStatusHandler(),
    new DeleteTaskHandler(),
    new TaskCountHandler(),
    new CompletedCountHandler(),
    new SummaryHandler(),
    new NextDeadlineHandler(),
    // Shopping handler
    new ShoppingListHandler(),
    // Workout handlers
    new AddWorkoutHandler(),
    new GetWorkoutsHandler(),
    // Meal handlers
    new LogMealHandler(),
    new GetCaloriesHandler(),
    // Note handlers
    new AddNoteHandler(),
    new ReadNotesHandler(),
    // Energy handler
    new LogEnergyHandler(),
    // Utility handlers
    new ConnectionStatusHandler(),
    new UnhandledIntentHandler(),
    new SessionEndedHandler()
  )
  .addRequestInterceptors(
    {
      async process(handlerInput) {
        const req = handlerInput.requestEnvelope.request;
        const intentName = (req as any)?.intent?.name ?? '';
        console.log('[Request]', req.type, intentName);
      }
    },
    new AuthInterceptor(),
    new NotionConnectionInterceptor()
  )
  .addErrorHandlers({
    canHandle() {
      return true;
    },
    async handle(handlerInput, error) {
      const authResponse = handleAuthError(error, handlerInput);
      if (authResponse) return authResponse;
      return new ErrorHandler().handle(handlerInput);
    }
  })
  .withCustomUserAgent('notion-assistant-skill/v1.0')
  .lambda();

// ======================================================================
// LAMBDA ENTRY (TS-safe, callback-compatible)
// ======================================================================

export const handler = async (event: any, context: any) => {
  context.callbackWaitsForEmptyEventLoop = true;

  return new Promise((resolve) => {
    skill(event, context, (err: any, result: any) => {
      if (err) {
        console.error('[Lambda] Fatal error:', err);
        resolve({
          version: '1.0',
          response: {
            outputSpeech: {
              type: 'PlainText',
              text: 'Sorry, something went wrong. Please try again.'
            },
            shouldEndSession: true
          }
        });
      } else {
        resolve(result);
      }
    });
  });
};
