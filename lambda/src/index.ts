import { SkillBuilders } from 'ask-sdk-core';
import { RequestEnvelope } from 'ask-sdk-model';
import { LaunchRequestHandler } from './handlers/LaunchRequestHandler';
import { TaskListHandler } from './handlers/TaskListHandler';
import { AddTaskHandler } from './handlers/AddTaskHandler';
import { MarkTaskCompleteHandler } from './handlers/MarkTaskCompleteHandler';
import { UpdateTaskStatusHandler } from './handlers/UpdateTaskStatusHandler';
import { DeleteTaskHandler } from './handlers/DeleteTaskHandler';
import { ConnectionStatusHandler } from './handlers/ConnectionStatusHandler';
import { BrainDumpHandler } from './handlers/BrainDumpHandler';
import { UnhandledIntentHandler } from './handlers/UnhandledIntentHandler';
import { SessionEndedHandler } from './handlers/SessionEndedHandler';
import { ErrorHandler } from './handlers/ErrorHandler';
// import { PriorityListHandler } from './handlers/PriorityListHandler';
// import { FocusTimerHandler } from './handlers/FocusTimerHandler';
// import { EnergyTrackerHandler } from './handlers/EnergyTrackerHandler';
// import { ScheduleHandler } from './handlers/ScheduleHandler';
// import { ShoppingListHandler } from './handlers/ShoppingListHandler';
import { NotionConnectionInterceptor } from './interceptors/NotionConnectionInterceptor';
import { AuthInterceptor, handleAuthError } from './middleware/auth';

const skillBuilder = SkillBuilders.custom();

// Create the skill handler with all interceptors
const lambdaHandler = skillBuilder
  .addRequestHandlers(
    new LaunchRequestHandler(),
    // MVP: Core Task CRUD operations only
    new TaskListHandler(),
    new BrainDumpHandler(), // Must be before AddTaskHandler to handle BrainDumpIntent
    new AddTaskHandler(),
    new MarkTaskCompleteHandler(),
    new UpdateTaskStatusHandler(),
    new DeleteTaskHandler(),
    new ConnectionStatusHandler(),
    // MVP: Non-essential handlers disabled
    // new PriorityListHandler(),
    // new FocusTimerHandler(),
    // new EnergyTrackerHandler(),
    // new ScheduleHandler(),
    // new ShoppingListHandler(),
    new UnhandledIntentHandler(), // Must be before SessionEndedHandler
    new SessionEndedHandler()
  )
  .addRequestInterceptors(
    // Logging interceptor - runs first
    {
      async process(handlerInput: any) {
        try {
          const request = handlerInput.requestEnvelope.request;
          const userId = handlerInput.requestEnvelope.session?.user?.userId;
          const accessToken = (handlerInput.requestEnvelope.context?.System?.user as any)?.accessToken;
          
          console.log('[Request Interceptor] Request type:', request.type);
          console.log('[Request Interceptor] User ID:', userId);
          console.log('[Request Interceptor] Has access token:', !!accessToken);
          console.log('[Request Interceptor] Request ID:', handlerInput.requestEnvelope.request.requestId);
          console.log('[Request Interceptor] Session ID:', handlerInput.requestEnvelope.session?.sessionId);
          
          // Log intent details if it's an IntentRequest
          if (request.type === 'IntentRequest') {
            const intent = (request as any).intent;
            console.log('[Request Interceptor] Intent name:', intent?.name);
            console.log('[Request Interceptor] Intent slots:', JSON.stringify(intent?.slots || {}));
            console.log('[Request Interceptor] Intent confirmation status:', intent?.confirmationStatus);
            
            // Also log raw input if available to help debug routing issues
            const rawInput = (request as any).input?.text || (request as any).rawInput || '';
            if (rawInput) {
              console.log('[Request Interceptor] Raw input:', rawInput);
            }
          }
        } catch (error: any) {
          console.error('[Request Interceptor] Error in logging:', error?.message);
          // Don't throw - just log and continue
        }
      }
    },
    // Auth interceptor - validates JWT tokens and attaches user info
    new AuthInterceptor(),
    // License validation disabled for MVP - focus on CRUD operations only
    // new LicenseValidationInterceptor(), // Disabled for MVP
    new NotionConnectionInterceptor()
  )
  .addErrorHandlers(
    // Custom error handler that checks for auth errors
    {
      canHandle() {
        return true;
      },
      async handle(handlerInput: any) {
        const error = (handlerInput as any).error;
        
        // Check if it's an auth error
        const authResponse = handleAuthError(error, handlerInput);
        if (authResponse) {
          return authResponse;
        }
        
        // Fall through to default error handler
        return new ErrorHandler().handle(handlerInput);
      }
    },
    new ErrorHandler()
  )
  .withCustomUserAgent('notion-assistant-skill/v1.0');

// Wrap the handler to catch auth errors
export const handler = async (event: any, context: any, callback: any) => {
  // Ensure Lambda waits for all async operations to complete
  context.callbackWaitsForEmptyEventLoop = true;
  
  try {
    console.log('='.repeat(80));
    console.log('[LAMBDA HANDLER] Lambda function entry point');
    console.log('[LAMBDA HANDLER] Event received:', JSON.stringify(event).substring(0, 500));
    console.log('[LAMBDA HANDLER] Context:', JSON.stringify(context).substring(0, 500));
    console.log('='.repeat(80));
    
    // Call the actual skill handler
    const skillHandler = lambdaHandler.lambda();
    const result: any = await skillHandler(event, context, callback);
    
    console.log('[LAMBDA HANDLER] Handler completed, result type:', typeof result);
    
    // The skill handler should always return a response
    // If it doesn't, the SDK will handle it, but we log for debugging
    if (result != null && typeof result === 'object' && 'response' in result) {
      console.log('[LAMBDA HANDLER] Result has response property');
    }
    
    return result;
  } catch (error: any) {
    console.error('[LAMBDA HANDLER] Fatal error at entry point:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name
    });
    
    // If it's an auth error, return the response
    if (error?.response) {
      return error.response;
    }
    
    // Return error response instead of throwing
    return {
      version: '1.0',
      response: {
        outputSpeech: {
          type: 'PlainText',
          text: 'Welcome to Notion Data. I encountered an error. Please try again.'
        },
        shouldEndSession: true
      }
    };
  }
};
