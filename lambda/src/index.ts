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
    new LicenseValidationInterceptor(),
    new NotionConnectionInterceptor()
  )
  .addErrorHandlers(new ErrorHandler())
  .withCustomUserAgent('notion-assistant-skill/v1.0')
  .lambda();

