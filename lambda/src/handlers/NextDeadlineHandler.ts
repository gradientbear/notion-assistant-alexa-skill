import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse } from '../utils/alexa';
import { findDatabaseByName, getNextDeadline } from '../utils/notion';

export class NextDeadlineHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest
      ? (handlerInput.requestEnvelope.request as any).intent?.name
      : null;
    
    const canHandle = isIntentRequest && intentName === 'NextDeadlineIntent';
    
    return canHandle;
  }

  async handle(handlerInput: HandlerInput) {
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;

    if (!user || !notionClient) {
      return buildResponse(
        handlerInput,
        'To check your next deadline, you need to connect your Notion account.',
        'What would you like to do?'
      );
    }

    try {
      const tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
      if (!tasksDbId) {
        return buildResponse(
          handlerInput,
          'I couldn\'t find your Tasks database in Notion.',
          'What would you like to do?'
        );
      }

      const nextDeadline = await getNextDeadline(notionClient, tasksDbId);
      
      if (!nextDeadline) {
        return buildResponse(
          handlerInput,
          'You have no upcoming deadlines.',
          'What else would you like to do?'
        );
      }

      const deadlineDate = nextDeadline.dueDate 
        ? new Date(nextDeadline.dueDate)
        : null;
      
      let speechText = `Your next deadline is ${nextDeadline.name}`;
      if (deadlineDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const deadlineOnly = new Date(deadlineDate);
        deadlineOnly.setHours(0, 0, 0, 0);
        
        const daysDiff = Math.round((deadlineOnly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === 0) {
          speechText += ', due today';
        } else if (daysDiff === 1) {
          speechText += ', due tomorrow';
        } else if (daysDiff > 1 && daysDiff <= 7) {
          speechText += `, due in ${daysDiff} days`;
        } else {
          speechText += `, due ${deadlineDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
        }
      }
      speechText += '.';

      return buildResponse(handlerInput, speechText, 'What else would you like to do?');
    } catch (error: any) {
      console.error('[NextDeadlineHandler] Error:', error);
      return buildResponse(
        handlerInput,
        'I encountered an error finding your next deadline. Please try again.',
        'What would you like to do?'
      );
    }
  }
}

