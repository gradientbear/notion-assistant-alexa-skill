import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse } from '../utils/alexa';
import { findDatabaseByName, addTask, parseTaskFromUtterance } from '../utils/notion';

export class AddTaskHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    return (
      handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      handlerInput.requestEnvelope.request.intent.name === 'AddTaskIntent'
    );
  }

  async handle(handlerInput: HandlerInput) {
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;

    if (!user || !notionClient) {
      return buildResponse(
        handlerInput,
        'Please link your Notion account in the Alexa app to use this feature.',
        'What would you like to do?'
      );
    }

    try {
      const request = handlerInput.requestEnvelope.request as any;
      const taskSlot = request.intent.slots?.task?.value;

      if (!taskSlot || taskSlot.trim().length === 0) {
        return buildResponse(
          handlerInput,
          'What task would you like to add?',
          'Tell me the task you want to add.'
        );
      }

      const tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
      if (!tasksDbId) {
        return buildResponse(
          handlerInput,
          'I couldn\'t find your Tasks database in Notion. Please make sure it exists and try again.',
          'What would you like to do?'
        );
      }

      // Parse task properties from utterance
      const parsed = parseTaskFromUtterance(taskSlot);
      
      if (!parsed.taskName || parsed.taskName.trim().length === 0) {
        return buildResponse(
          handlerInput,
          'I couldn\'t understand the task name. Please try again.',
          'What task would you like to add?'
        );
      }

      // Add task with parsed properties
      await addTask(
        notionClient,
        tasksDbId,
        parsed.taskName,
        parsed.priority || 'Medium',
        parsed.category || 'Personal',
        parsed.dueDate
      );

      // Build confirmation message
      let confirmation = `Added: ${parsed.taskName}`;
      
      if (parsed.priority === 'High') {
        confirmation = `Added high priority task: ${parsed.taskName}`;
      } else if (parsed.priority === 'Low') {
        confirmation = `Added low priority task: ${parsed.taskName}`;
      }

      if (parsed.dueDate) {
        const dueDate = new Date(parsed.dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDateOnly = new Date(dueDate);
        dueDateOnly.setHours(0, 0, 0, 0);

        if (dueDateOnly.getTime() === today.getTime()) {
          confirmation += ', due today';
        } else if (dueDateOnly.getTime() === today.getTime() + 86400000) {
          confirmation += ', due tomorrow';
        } else {
          confirmation += `, due ${dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        }
      }

      if (parsed.category && parsed.category !== 'Personal') {
        confirmation += ` to ${parsed.category.toLowerCase()}`;
      }

      confirmation += '.';

      return buildResponse(handlerInput, confirmation, 'What else would you like to do?');
    } catch (error) {
      console.error('Error adding task:', error);
      return buildResponse(
        handlerInput,
        'I encountered an error adding your task. Please try again.',
        'What would you like to do?'
      );
    }
  }
}

