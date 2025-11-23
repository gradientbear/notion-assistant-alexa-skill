import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildSimpleResponse } from '../utils/alexa';
import { findDatabaseByName, getTopPriorityTasks } from '../utils/notion';

export class PriorityListHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    return (
      handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      handlerInput.requestEnvelope.request.intent.name === 'PriorityListIntent'
    );
  }

  async handle(handlerInput: HandlerInput) {
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;

    if (!user || !notionClient) {
      return buildSimpleResponse(
        handlerInput,
        'Please link your Notion account in the Alexa app to use this feature.'
      );
    }

    try {
      const tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
      if (!tasksDbId) {
        return buildSimpleResponse(
          handlerInput,
          'I couldn\'t find your Tasks database in Notion. ' +
          'Please make sure it exists and try again.'
        );
      }

      const tasks = await getTopPriorityTasks(notionClient, tasksDbId, 3);

      if (tasks.length === 0) {
        return buildSimpleResponse(
          handlerInput,
          'You have no priority tasks right now. Great job staying on top of things!'
        );
      }

      let speechText = 'Here are your top 3 priority tasks: ';
      tasks.forEach((task, index) => {
        speechText += `${index + 1}. ${task.name}`;
        if (task.priority === 'High') {
          speechText += ', high priority';
        }
        if (task.dueDate) {
          const dueDate = new Date(task.dueDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const dueDateOnly = new Date(dueDate);
          dueDateOnly.setHours(0, 0, 0, 0);
          
          if (dueDateOnly.getTime() === today.getTime()) {
            speechText += ', due today';
          } else if (dueDateOnly.getTime() < today.getTime()) {
            speechText += ', overdue';
          } else {
            speechText += `, due ${dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
          }
        }
        speechText += '. ';
      });

      return buildSimpleResponse(handlerInput, speechText);
    } catch (error) {
      console.error('Error getting priority tasks:', error);
      return buildSimpleResponse(
        handlerInput,
        'I encountered an error retrieving your priority tasks. Please try again later.'
      );
    }
  }
}

