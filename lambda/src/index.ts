import { SkillBuilders } from 'ask-sdk-core';
import { LaunchRequestHandler } from './handlers/LaunchRequestHandler';
import { QueryTasksHandler } from './handlers/QueryTasksHandler';
import { AddTaskHandler } from './handlers/AddTaskHandler';
import { UpdateTaskHandler } from './handlers/UpdateTaskHandler';
import { DeleteTaskHandler } from './handlers/DeleteTaskHandler';
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
    // Task handlers (new interaction model)
    new QueryTasksHandler(),
    new AddTaskHandler(),
    new UpdateTaskHandler(),
    new DeleteTaskHandler(),
    // Utility handlers
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
