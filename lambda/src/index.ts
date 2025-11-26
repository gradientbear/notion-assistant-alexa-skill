import { SkillBuilders } from 'ask-sdk-core';
import { RequestEnvelope } from 'ask-sdk-model';
import { LaunchRequestHandler } from './handlers/LaunchRequestHandler';
import { BrainDumpHandler } from './handlers/BrainDumpHandler';
import { PriorityListHandler } from './handlers/PriorityListHandler';
import { FocusTimerHandler } from './handlers/FocusTimerHandler';
import { EnergyTrackerHandler } from './handlers/EnergyTrackerHandler';
import { ScheduleHandler } from './handlers/ScheduleHandler';
import { ShoppingListHandler } from './handlers/ShoppingListHandler';
import { SessionEndedHandler } from './handlers/SessionEndedHandler';
import { ErrorHandler } from './handlers/ErrorHandler';
import { LicenseValidationInterceptor } from './interceptors/LicenseValidationInterceptor';
import { NotionConnectionInterceptor } from './interceptors/NotionConnectionInterceptor';

export const handler = SkillBuilders.custom()
  .addRequestHandlers(
    new LaunchRequestHandler(),
    new BrainDumpHandler(),
    new PriorityListHandler(),
    new FocusTimerHandler(),
    new EnergyTrackerHandler(),
    new ScheduleHandler(),
    new ShoppingListHandler(),
    new SessionEndedHandler()
  )
  .addRequestInterceptors(
    // Logging interceptor - runs first
    {
      async process(handlerInput: any) {
        try {
          const request = handlerInput.requestEnvelope.request;
          const userId = handlerInput.requestEnvelope.session?.user?.userId;
          console.log('[Request Interceptor] Request type:', request.type);
          console.log('[Request Interceptor] User ID:', userId);
          // Only log essential parts to avoid circular reference issues
          console.log('[Request Interceptor] Request ID:', handlerInput.requestEnvelope.request.requestId);
          console.log('[Request Interceptor] Session ID:', handlerInput.requestEnvelope.session?.sessionId);
        } catch (error: any) {
          console.error('[Request Interceptor] Error in logging:', error?.message);
          // Don't throw - just log and continue
        }
      }
    },
    // License validation can be disabled by setting DISABLE_LICENSE_VALIDATION=true
    new LicenseValidationInterceptor(),
    new NotionConnectionInterceptor()
  )
  .addErrorHandlers(new ErrorHandler())
  .withCustomUserAgent('notion-assistant-skill/v1.0')
  .lambda();

