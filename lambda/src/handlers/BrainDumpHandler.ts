import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { IntentRequest } from 'ask-sdk-model';
import { buildResponse, buildSimpleResponse } from '../utils/alexa';
import { findDatabaseByName, addTask } from '../utils/notion';

export class BrainDumpHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    return (
      handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      handlerInput.requestEnvelope.request.intent.name === 'BrainDumpIntent'
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

    const request = handlerInput.requestEnvelope.request as IntentRequest;
    const taskSlot = request.intent.slots?.task;

    // Check if we're in a multi-turn conversation
    const conversationState = attributes.brainDumpState || 'initial';

    if (conversationState === 'initial') {
      // Start the brain dump conversation
      attributes.brainDumpState = 'collecting';
      attributes.brainDumpTasks = [];
      handlerInput.attributesManager.setSessionAttributes(attributes);

      return buildResponse(
        'I\'m ready to capture your thoughts. What tasks would you like to add?',
        'Tell me the tasks you want to add, or say done when finished.'
      );
    }

    if (conversationState === 'collecting') {
      const userUtterance = request.intent.slots?.task?.value;

      if (!userUtterance) {
        return buildResponse(
          'I didn\'t catch that. What tasks would you like to add?',
          'Tell me the tasks, or say done when finished.'
        );
      }

      // Check if user said "done" or similar
      const donePhrases = ['done', 'finished', 'that\'s all', 'complete', 'nothing'];
      if (donePhrases.some(phrase => userUtterance.toLowerCase().includes(phrase))) {
        // Save all collected tasks
        const tasks = attributes.brainDumpTasks || [];
        
        if (tasks.length === 0) {
          attributes.brainDumpState = 'initial';
          handlerInput.attributesManager.setSessionAttributes(attributes);
          return buildSimpleResponse('No tasks were added.');
        }

        // Find tasks database
        const tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
        if (!tasksDbId) {
          attributes.brainDumpState = 'initial';
          handlerInput.attributesManager.setSessionAttributes(attributes);
          return buildSimpleResponse(
            'I couldn\'t find your Tasks database in Notion. ' +
            'Please make sure it exists and try again.'
          );
        }

        // Add all tasks
        try {
          for (const taskName of tasks) {
            await addTask(notionClient, tasksDbId, taskName);
          }

          attributes.brainDumpState = 'initial';
          handlerInput.attributesManager.setSessionAttributes(attributes);

          return buildSimpleResponse(
            `Great! I've added ${tasks.length} task${tasks.length > 1 ? 's' : ''} to your Notion database.`
          );
        } catch (error) {
          console.error('Error adding tasks:', error);
          attributes.brainDumpState = 'initial';
          handlerInput.attributesManager.setSessionAttributes(attributes);
          return buildSimpleResponse(
            'I encountered an error adding your tasks. Please try again later.'
          );
        }
      }

      // Add task to collection
      const tasks = attributes.brainDumpTasks || [];
      tasks.push(userUtterance);
      attributes.brainDumpTasks = tasks;
      handlerInput.attributesManager.setSessionAttributes(attributes);

      return buildResponse(
        `Got it. Added "${userUtterance}". What else?`,
        'Tell me another task, or say done when finished.'
      );
    }

    return buildSimpleResponse('I\'m not sure what you want to do. Please try again.');
  }
}

