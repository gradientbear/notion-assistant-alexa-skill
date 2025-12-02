import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse } from '../utils/alexa';
import { findDatabaseByName, getSummary } from '../utils/notion';

export class SummaryHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest
      ? (handlerInput.requestEnvelope.request as any).intent?.name
      : null;
    
    const canHandle = isIntentRequest && intentName === 'SummaryIntent';
    
    return canHandle;
  }

  async handle(handlerInput: HandlerInput) {
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;

    if (!user || !notionClient) {
      return buildResponse(
        handlerInput,
        'To get your productivity summary, you need to connect your Notion account.',
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

      const summary = await getSummary(notionClient, tasksDbId);
      
      let speechText = `Here's your productivity summary. `;
      speechText += `You have ${summary.totalTasks} total task${summary.totalTasks !== 1 ? 's' : ''}, `;
      speechText += `${summary.completedTasks} completed, `;
      speechText += `and ${summary.pendingTasks} pending. `;
      
      if (summary.overdueTasks > 0) {
        speechText += `You have ${summary.overdueTasks} overdue task${summary.overdueTasks !== 1 ? 's' : ''}. `;
      }
      
      if (summary.nextDeadline) {
        const deadlineDate = summary.nextDeadline.dueDate 
          ? new Date(summary.nextDeadline.dueDate)
          : null;
        if (deadlineDate) {
          speechText += `Your next deadline is ${summary.nextDeadline.name} due ${deadlineDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.`;
        } else {
          speechText += `Your next deadline is ${summary.nextDeadline.name}.`;
        }
      } else {
        speechText += 'You have no upcoming deadlines.';
      }

      return buildResponse(handlerInput, speechText, 'What else would you like to do?');
    } catch (error: any) {
      console.error('[SummaryHandler] Error:', error);
      return buildResponse(
        handlerInput,
        'I encountered an error getting your summary. Please try again.',
        'What would you like to do?'
      );
    }
  }
}

