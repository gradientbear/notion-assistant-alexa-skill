import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildSimpleResponse } from '../utils/alexa';
import { findDatabaseByName, getTodayTasks } from '../utils/notion';

export class ScheduleHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    return (
      handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      handlerInput.requestEnvelope.request.intent.name === 'ScheduleIntent'
    );
  }

  async handle(handlerInput: HandlerInput) {
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;

    if (!user || !notionClient) {
      return buildSimpleResponse(
        'Please link your Notion account in the Alexa app to use this feature.'
      );
    }

    try {
      const tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
      if (!tasksDbId) {
        return buildSimpleResponse(
          'I couldn\'t find your Tasks database in Notion. ' +
          'Please make sure it exists and try again.'
        );
      }

      const tasks = await getTodayTasks(notionClient, tasksDbId);

      if (tasks.length === 0) {
        return buildSimpleResponse(
          'You have no tasks scheduled for today. Enjoy your free day!'
        );
      }

      let speechText = `You have ${tasks.length} task${tasks.length > 1 ? 's' : ''} for today: `;
      tasks.forEach((task, index) => {
        speechText += `${index + 1}. ${task.name}`;
        if (task.priority === 'High') {
          speechText += ', high priority';
        }
        if (task.category) {
          speechText += `, ${task.category}`;
        }
        speechText += '. ';
      });

      return buildSimpleResponse(speechText);
    } catch (error) {
      console.error('Error getting schedule:', error);
      return buildSimpleResponse(
        'I encountered an error retrieving your schedule. Please try again later.'
      );
    }
  }
}

